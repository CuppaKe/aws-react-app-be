import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput, Duration, Fn } from "aws-cdk-lib";
import { Function, Runtime, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export class UploadServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Retrieve SQS queue details from SSM
    const queueUrl = StringParameter.valueForStringParameter(
      this,
      "/product-service/catalog-items-queue-url"
    );
    const queueArn = StringParameter.valueForStringParameter(
      this,
      "/product-service/catalog-items-queue-arn"
    );

    // Import existing S3 bucket
    const uploadBucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "aws-react-app-import-service"
    );

    // Create Lambda Layer for CSV Parser
    const csvParserLayer = new LayerVersion(this, "CsvParserLayer", {
      code: Code.fromAsset(path.join(__dirname, "../layers/csv-parser-layer")),
      compatibleRuntimes: [Runtime.NODEJS_20_X],
      description: "Layer containing csv-parser package",
    });

    // Import Lambda Authorizer Function
    const authorizerFunction = Function.fromFunctionArn(
      this,
      "ImportedAuthorizerFunction",
      Fn.importValue("AuthorizerFunctionArn")
    );

    // Create REST API Gateway
    const api = new apigateway.RestApi(this, "import-service-api", {
      restApiName: "Import Service API",
      description: "Import Service API using REST API Gateway",
      deployOptions: {
        stageName: "prod",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ["Authorization", "Content-Type"],
      },
    });

    // Add gateway responses
    api.addGatewayResponse("Unauthorized", {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: "401",
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        "Content-Type": "'application/json'",
      },
      templates: {
        "application/json": '{"message": "Authorization required"}',
      },
    });

    api.addGatewayResponse("Forbidden", {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: "403",
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        "Content-Type": "'application/json'",
      },
      templates: {
        "application/json": '{"message": "$context.authorizer.message"}',
      },
    });

    // Create Lambda Function for Importing Products
    const importProductsFileLambda = new Function(
      this,
      "ImportProductsFileFunction",
      {
        runtime: Runtime.NODEJS_20_X,
        handler: "importProductsFile.handler",
        code: Code.fromAsset(path.join(__dirname, "../lambda"), {
          assetHash: Date.now().toString(),
          exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
        }),
        environment: {
          UPLOAD_BUCKET: uploadBucket.bucketName,
          ALLOWED_ORIGIN: "*",
        },
      }
    );

    // Create Import File Parser Lambda with the CSV Parser Layer
    const importFileParserLambda = new Function(
      this,
      "ImportFileParserFunction",
      {
        runtime: Runtime.NODEJS_20_X,
        handler: "importFileParser.handler",
        code: Code.fromAsset(path.join(__dirname, "../lambda"), {
          assetHash: Date.now().toString(),
          exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
        }),
        environment: {
          UPLOAD_BUCKET: uploadBucket.bucketName,
          SQS_QUEUE_URL: queueUrl,
        },
        timeout: Duration.seconds(60),
        layers: [csvParserLayer],
      }
    );

    // Add permissions for S3 access to importProductsFile Lambda
    importProductsFileLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [`${uploadBucket.bucketArn}/uploaded/*`],
      })
    );

    // Add permissions for S3 and SQS access to importFileParser Lambda
    importFileParserLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:CopyObject",
          "sqs:SendMessage",
        ],
        resources: [`${uploadBucket.bucketArn}/*`, queueArn],
      })
    );

    // Configure S3 event notification for file uploads
    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserLambda),
      { prefix: "uploaded/", suffix: ".csv" }
    );

    // Create Lambda Token Authorizer for API Gateway
    const authorizer = new apigateway.TokenAuthorizer(
      this,
      "ImportAuthorizer",
      {
        handler: authorizerFunction,
        identitySource: apigateway.IdentitySource.header("Authorization"),
      }
    );

    // Create API Gateway resource: `/import`
    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFileLambda),
      {
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        authorizer,
      }
    );

    // Output API URL
    new CfnOutput(this, "ApiUrl", {
      value: api.url ?? "Something went wrong with the API URL",
      description: "Import Service API URL",
    });
  }
}
