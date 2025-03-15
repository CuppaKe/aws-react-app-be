import { Construct } from "constructs";
import {
  Stack,
  StackProps,
  CfnOutput,
  Duration,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import {
  HttpApi,
  CorsHttpMethod,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Queue } from "aws-cdk-lib/aws-sqs";
import * as path from "path";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StringParameter } from "aws-cdk-lib/aws-ssm";

import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create SQS Queue
    const catalogItemsQueue = new Queue(this, "CatalogItemsQueue", {
      queueName: "CatalogItemsQueue",
      visibilityTimeout: Duration.seconds(60),
      removalPolicy: RemovalPolicy.DESTROY,
      receiveMessageWaitTime: Duration.seconds(5),
    });

    new StringParameter(this, "CatalogItemsQueueUrl", {
      parameterName: "/product-service/catalog-items-queue-url",
      stringValue: catalogItemsQueue.queueUrl,
    });

    new StringParameter(this, "CatalogItemsQueueArn", {
      parameterName: "/product-service/catalog-items-queue-arn",
      stringValue: catalogItemsQueue.queueArn,
    });

    // Create SNS Topic
    const createProductTopic = new sns.Topic(this, "CreateProductTopic", {
      topicName: "create-product-topic",
      displayName: "Product Creation Notifications",
    });

    // Add email subscription
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription("leleh31588@doishy.com")
    );

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription("vijiba3127@excederm.com", {
        filterPolicy: {
          count: sns.SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 30,
          }),
        },
      })
    );

    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ImportedProductsTable",
      "products"
    );

    const stocksTable = dynamodb.Table.fromTableName(
      this,
      "ImportedStocksTable",
      "stocks"
    );

    // Lambda function for getProducts
    const getProductsLambda = new Function(this, "GetProductsFunction", {
      runtime: Runtime.NODEJS_20_X, // or later
      handler: "getProducts.handler",
      code: Code.fromAsset(path.join(__dirname, "../lambda"), {
        // This will force update when code changes
        assetHash: Date.now().toString(),
        exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
      }),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      },
    });

    // Lambda function for getProductById
    const getProductByIdLambda = new Function(this, "GetProductByIdFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "getProductById.handler",
      code: Code.fromAsset(path.join(__dirname, "../lambda"), {
        // This will force update when code changes
        assetHash: Date.now().toString(),
        exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
      }),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      },
    });

    // Lambda function for getProductById
    const createProductLambda = new Function(this, "CreateProductFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "createProduct.handler",
      code: Code.fromAsset(path.join(__dirname, "../lambda"), {
        // This will force update when code changes
        assetHash: Date.now().toString(),
        exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
      }),
      environment: {
        ALLOWED_ORIGIN: "*",
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      },
    });

    // Lambda function for batching catalog
    const catalogBatchProcess = new Function(this, "CatalogBatchProcess", {
      runtime: Runtime.NODEJS_20_X,
      handler: "catalogBatchProcess.handler",
      code: Code.fromAsset(path.join(__dirname, "../lambda"), {
        // This will force update when code changes
        assetHash: Date.now().toString(),
        exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
      }),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      },
      timeout: Duration.seconds(60),
    });

    catalogBatchProcess.addEventSource(
      new SqsEventSource(catalogItemsQueue, {
        batchSize: 5,
        maxBatchingWindow: Duration.seconds(5),
        reportBatchItemFailures: true,
      })
    );

    catalogItemsQueue.grantConsumeMessages(catalogBatchProcess);
    catalogItemsQueue.grant(catalogBatchProcess, "sqs:DeleteMessage");

    createProductTopic.grantPublish(catalogBatchProcess);

    // Grant permissions to Lambda functions
    productsTable.grantReadData(getProductsLambda);
    productsTable.grantReadData(getProductByIdLambda);
    productsTable.grantReadWriteData(createProductLambda);
    productsTable.grantWriteData(catalogBatchProcess);

    stocksTable.grantReadData(getProductByIdLambda);
    stocksTable.grantReadData(getProductsLambda);
    stocksTable.grantReadWriteData(createProductLambda);
    stocksTable.grantWriteData(catalogBatchProcess);

    // HTTP API
    const api = new HttpApi(this, "product-service-api", {
      apiName: "Product Service API",
      description: "API for managing products",
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ["*"],
        maxAge: Duration.days(1),
        exposeHeaders: ["*"],
      },
    });

    // Add routes for HTTP API
    api.addRoutes({
      path: "/products",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "GetProductsIntegration",
        getProductsLambda
      ),
    });

    api.addRoutes({
      path: "/products/{id}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration(
        "GetProductsIntegration",
        getProductByIdLambda
      ),
    });

    api.addRoutes({
      path: "/products",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration(
        "CreateProductIntegration",
        createProductLambda
      ),
    });

    // Output the API URL
    new CfnOutput(this, "ApiUrl", {
      value: api.url ?? "Something went wrong with the API URL",
    });
  }
}
