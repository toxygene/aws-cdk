#!/usr/bin/env node

/**
 * Stack verification steps:
 * * aws sns get-topic-attributes --topic-arn <deployed topic arn> : should return SQSSuccessFeedbackSampleRate as 100
 */

import { ExpectedResult, IntegTest } from '@aws-cdk/integ-tests-alpha';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { AwsCustomResource, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

class TestStack extends Stack {
  readonly topic: Topic;
  readonly role: Role;
  readonly managedPolicy: ManagedPolicy;
  readonly customResource: AwsCustomResource;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.topic = new Topic(this, 'Topic');

    this.role = new Role(this, 'Role', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    });

    this.managedPolicy = new ManagedPolicy(this, 'ManagedPolicy', {
      roles: [this.role],
      statements: [
        new PolicyStatement({
          actions: [
            'sns:SetTopicAttributes',
          ],
          effect: Effect.ALLOW,
          resources: [this.topic.topicArn],
        }),
      ],
    });

    this.customResource = new AwsCustomResource(
      this,
      'CustomResource',
      {
        onCreate: {
          service: 'sns',
          action: 'SetTopicAttributes',
          parameters: {
            AttributeName: 'SQSSuccessFeedbackSampleRate',
            AttributeValue: '100',
            TopicArn: this.topic.topicArn,
            Version: '2010-03-31',
          },
          physicalResourceId: PhysicalResourceId.of(`${this.topic.topicName}-SQSSuccessFeedbackSampleRate`),
        },
        role: this.role,
      },
    );

    this.customResource.node.addDependency(this.managedPolicy);
  }
}

const app = new App();

const stack = new TestStack(app, 'aws-cdk-customresources-dependency');
const integ = new IntegTest(app, 'Destinations', {
  testCases: [stack],
});

const topicAttributes = integ.assertions.awsApiCall('SNS', 'getTopicAttributes', {
  TopicArn: stack.topic.topicArn,
});

topicAttributes.expect(ExpectedResult.objectLike({
  Attributes: {
    SQSSuccessFeedbackSampleRate: '100',
  },
}));