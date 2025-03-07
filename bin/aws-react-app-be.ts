import * as cdk from "aws-cdk-lib";
import { ProductServiceStack } from "../services/product-service/lib/product-service-stack";
import { UploadServiceStack } from "../services/upload-service/lib/upload-service-stack";

const app = new cdk.App();
new ProductServiceStack(app, "ProductServiceStack");
new UploadServiceStack(app, "UploadServiceStack");
