import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import {
  HttpApi,
  CorsHttpMethod,
  HttpMethod,
} from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";

import * as path from "path";

export class ProductServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Lambda function for getProducts
    const getProductsLambda = new Function(this, "GetProductsFunction", {
      runtime: Runtime.NODEJS_20_X, // or later
      handler: "getProducts.handler",
      code: Code.fromAsset(path.join(__dirname, "../lambda")),
    });

    // Lambda function for getProductById
    const getProductByIdLambda = new Function(this, "GetProductByIdFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "getProductById.handler",
      code: Code.fromAsset(path.join(__dirname, "../lambda")),
    });

    // HTTP API
    const api = new HttpApi(this, "product-service-api", {
      apiName: "Product Service API",
      description: "API for managing products",
      corsPreflight: {
        allowHeaders: ["*"],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"],
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

    // Output the API URL
    new CfnOutput(this, "ApiUrl", {
      value: api.url ?? "Something went wrong with the API URL",
    });
  }
}
