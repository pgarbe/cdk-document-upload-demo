import { S3ToStepfunctions } from '@aws-solutions-constructs/aws-s3-stepfunctions';
import * as pg from '@pgarbe/cdk-ecr-sync';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class DocumentUploadStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);

    /**
     * Common infra
     */
    new pg.EcrSync(this, 'EcrSync', {
      dockerImages: [{ imageName: 'gotenberg/gotenberg', includeTags: ['^7$'] }],
    });
    const repo = cdk.aws_ecr.Repository.fromRepositoryName(this, 'Repo', 'gotenberg/gotenberg');

    const vpc = new cdk.aws_ec2.Vpc(this, 'Vpc', { natGateways: 0 });

    /**
     * Gotenberg Fargate Service
     */
    const app = new cdk.aws_ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Gotenberg', {
      vpc,
      assignPublicIp: true,
      publicLoadBalancer: true,
      taskImageOptions: {
        image: cdk.aws_ecs.ContainerImage.fromEcrRepository(repo, '7'),
        // image: cdk.aws_ecs.ContainerImage.fromRegistry('gotenberg/gotenberg'),
        containerPort: 3000,
      },
      cpu: 1024,
      memoryLimitMiB: 2048,
    });
    app.targetGroup.configureHealthCheck({
      enabled: true,
      path: '/health',
    });

    /**
     * Step functions to convert to PDF (using Fargate task) and enrich it
     */
    const pdfBucket = new cdk.aws_s3.Bucket(this, 'PdfBucket', { enforceSSL: true });
    const convertDocLambda = new cdk.aws_lambda_nodejs.NodejsFunction(this, 'ConvertDocLambda', {
      // vpc,
      timeout: cdk.Duration.minutes(3),
      environment: {
        GOTENBERG_URL: app.loadBalancer.loadBalancerDnsName,
        TARGET_BUCKET_NAME: pdfBucket.bucketName,
      },
    });
    pdfBucket.grantWrite(convertDocLambda);

    const convertJob = new cdk.aws_stepfunctions_tasks.LambdaInvoke(this, 'ConvertDoc', {
      lambdaFunction: convertDocLambda,
      // Pass just the field named "guid" into the Lambda, put the
      // Lambda's result in a field called "status" in the response
    });

    const jobFailed = new cdk.aws_stepfunctions.Fail(this, 'Job Failed', {
      cause: 'Gotenberg Convert Job Failed',
      error: 'INVALID_DOCUMENT',
    });

    const sendSuccessEvent = new cdk.aws_stepfunctions_tasks.EventBridgePutEvents(this, 'SendSuccess', {
      entries: [
        {
          source: 'DocumentUploadDemo',
          detailType: 'DOCUMENT_CONVERTED_EVENT',
          detail: cdk.aws_stepfunctions.TaskInput.fromJsonPathAt('$.Payload.convertResult'),
        },
      ],
    });

    const definition = convertJob
      .addCatch(jobFailed)
      .next(sendSuccessEvent);

    /**
     * The glue to bring all together
     */
    const theGlue = new S3ToStepfunctions(this, 'ConvertJob', {
      stateMachineProps: { definition, timeout: cdk.Duration.minutes(5) },
    });
    theGlue.s3Bucket!.grantRead(convertDocLambda);

    new cdk.CfnOutput(this, 'UploadBucketLink', { value: `https://s3.console.aws.amazon.com/s3/buckets/${theGlue.s3Bucket?.bucketName}` });
    new cdk.CfnOutput(this, 'PdfBucketLink', { value: `https://s3.console.aws.amazon.com/s3/buckets/${pdfBucket.bucketName}` });
  }
}

const app = new cdk.App();
new DocumentUploadStack(app, 'document-upload-dev', { env: { account: '424144556073', region: 'eu-west-1' } });

app.synth();