import * as cdk from 'aws-cdk-lib';
import { ProductServiceStack } from '../services/product-service/lib/product-service-stack';

const app = new cdk.App();
new ProductServiceStack(app, 'ProductServiceStack');
