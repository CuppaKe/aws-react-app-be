import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput, Duration } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import {
  HttpApi,
  CorsHttpMethod,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as path from "path";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      },
    });

    // Grant permissions to Lambda functions
    productsTable.grantReadData(getProductsLambda);
    productsTable.grantReadData(getProductByIdLambda);
    productsTable.grantReadWriteData(createProductLambda);

    stocksTable.grantReadData(getProductByIdLambda);
    stocksTable.grantReadData(getProductsLambda);
    stocksTable.grantReadWriteData(createProductLambda);

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
