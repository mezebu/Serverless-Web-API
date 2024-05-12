import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import { Domain } from "../../env";

interface FrontendProps {
  apiUrl?: string;
  authUrl?: string;
  certificate?: acm.Certificate;
  zone: route53.IHostedZone;
}

export class FrontendApp extends Construct {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: FrontendProps) {
    super(scope, id);

    const siteDomain = "movies" + "." + Domain;

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      bucketName: siteDomain,
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      // websiteIndexDocument: "index.html",
      // websiteErrorDocument: "error/index.html",
    });

    const oai = new cloudfront.OriginAccessIdentity(
      this,
      "OriginAccessIdentity"
    );

    siteBucket.grantRead(oai);

    const distribution = new cloudfront.Distribution(this, "SiteDistribution", {
      certificate: props.certificate,
      defaultRootObject: "index.html",
      domainNames: [siteDomain],
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      defaultBehavior: {
        origin: new cloudfront_origins.S3Origin(siteBucket, {
          originAccessIdentity: oai,
        }),
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    new route53.ARecord(this, "WWWSiteAliasRecord", {
      zone: props.zone,
      recordName: siteDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    const config = {
      apiUrl: props.apiUrl,
      authUrl: props.authUrl,
    };

    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [
        s3deploy.Source.asset("./dist"),
        s3deploy.Source.jsonData("config.json", config),
      ],
      destinationBucket: siteBucket,
      distribution: distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "DistributionDomain", {
      value: distribution.distributionDomainName,
    });
  }
}
