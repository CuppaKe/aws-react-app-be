import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";
import { Function, Runtime, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import {
  HttpApi,
  CorsHttpMethod,
  HttpMethod,
  PayloadFormatVersion,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications"; // Add this import
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export class UploadServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const uploadBucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "aws-react-app-import-service"
    );

    // Create Lambda Layer for csv-parser
    const csvParserLayer = new LayerVersion(this, "CsvParserLayer", {
      code: Code.fromAsset(path.join(__dirname, "../layers/csv-parser-layer")),
      compatibleRuntimes: [Runtime.NODEJS_20_X],
      description: "Layer containing csv-parser package",
    });

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

    // Create importFileParser Lambda with the csv-parser layer
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
        },
        timeout: Duration.seconds(60),
        layers: [csvParserLayer],
      }
    );

    // Add S3 permissions to importProductsFile Lambda
    importProductsFileLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject"],
        resources: [`${uploadBucket.bucketArn}/uploaded/*`],
      })
    );

    // Add S3 permissions to importFileParser Lambda
    importFileParserLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:CopyObject",
        ],
        resources: [`${uploadBucket.bucketArn}/*`],
      })
    );

    // Add S3 bucket notification configuration
    uploadBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParserLambda), // Use s3n.LambdaDestination
      { prefix: "uploaded/", suffix: ".csv" }
    );

    // Create HTTP API
    const api = new HttpApi(this, "import-service-api", {
      apiName: "Import Service API",
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"],
        maxAge: Duration.days(1),
      },
    });

    // Add route for importProductsFile
    api.addRoutes({
      path: "/import",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "ImportProductsFileIntegration",
        importProductsFileLambda,
        {
          payloadFormatVersion: PayloadFormatVersion.VERSION_2_0,
        }
      ),
    });

    // Outputs
    new CfnOutput(this, "ApiUrl", {
      value: api.url ?? "Something went wrong with the API URL",
      description: "Import Service API URL",
    });
  }
}
