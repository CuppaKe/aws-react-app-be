import { Construct } from "constructs";
import { Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

export class AuthorizationServiceStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const basicAuthorizerFunction = new Function(
      this,
      "BasicAuthorizerFunction",
      {
        runtime: Runtime.NODEJS_20_X,
        handler: "basicAuthorizer.handler",
        code: Code.fromAsset(path.join(__dirname, "../lambda"), {
          assetHash: Date.now().toString(),
          exclude: ["**/*.ts", "**/*.d.ts", "**/*.spec.*"],
        }),
        environment: {
          cuppake: <string>process.env.cuppake,
        },
      }
    );

    // Grant API Gateway permission to invoke the authorizer
    basicAuthorizerFunction.grantInvoke(
      new iam.ServicePrincipal("apigateway.amazonaws.com")
    );

    new CfnOutput(this, "AuthorizerFunctionArn", {
      value: basicAuthorizerFunction.functionArn,
      exportName: "AuthorizerFunctionArn",
    });
  }
}
