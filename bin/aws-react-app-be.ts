import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";

import { ProductServiceStack } from "../services/product-service/lib/product-service-stack";
import { UploadServiceStack } from "../services/upload-service/lib/upload-service-stack";
import { AuthorizationServiceStack } from "../services/authorization-service/lib/authorization-service-stack";

dotenv.config();

const app = new cdk.App();

const env = {
  account: process.env.ACCOUNT_ID,
  region: process.env.REGION,
};

const productStack = new ProductServiceStack(app, "ProductServiceStack", {
  env,
});
const uploadStack = new UploadServiceStack(app, "UploadServiceStack", { env });

const authorizationStack = new AuthorizationServiceStack(
  app,
  "AuthorizationServiceStack",
  { env }
);
uploadStack.addDependency(productStack);
uploadStack.addDependency(authorizationStack);
