import * as route53 from "aws-cdk-lib/aws-route53";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cdk from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { HostedZone, Domain } from "../../env";

export class CertStack extends Stack {
  public readonly certificate: acm.Certificate;
  public readonly zone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const subdomain = "movies";

    // Lookup hosted zone.
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "hostedZone",
      {
        zoneName: Domain,
        hostedZoneId: HostedZone,
      }
    );

    const certificate = new acm.Certificate(this, "siteCertificate", {
      domainName: subdomain + "." + Domain,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    certificate.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    this.certificate = certificate;
    this.zone = hostedZone;
  }
}
