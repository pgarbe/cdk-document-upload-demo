import * as pj from 'projen';

const project = new pj.awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'cdk-document-upload-demo',

  projenrcTs: true,
});
project.synth();