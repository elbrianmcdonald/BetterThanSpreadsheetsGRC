# Email Service Setup Guide

This guide covers the setup and configuration of email notifications in BetterThanSpreadsheetsGRC.

## Overview

BetterThanSpreadsheetsGRC supports three email providers:

1. **Console** (default) - Logs emails to console for development
2. **SendGrid** - Enterprise email delivery service
3. **AWS SES** - Amazon Simple Email Service

## Quick Start

### Development (Console Mode)

No configuration required. Emails are logged to the console by default.

```bash
# .env
EMAIL_PROVIDER="console"  # This is the default
```

### Production (SendGrid or AWS SES)

Choose one provider and configure the required environment variables.

---

## SendGrid Setup

### 1. Create a SendGrid Account

1. Go to [SendGrid](https://sendgrid.com) and create an account
2. Complete email verification
3. Optionally upgrade to a paid plan for higher sending limits

### 2. Create an API Key

1. Navigate to **Settings > API Keys**
2. Click **Create API Key**
3. Select **Restricted Access** and enable:
   - **Mail Send** > Full Access
4. Copy the API key immediately (it won't be shown again)

### 3. Verify Sender Identity

SendGrid requires sender verification for anti-spam compliance.

#### Option A: Single Sender Verification (Quick)
1. Go to **Settings > Sender Authentication > Single Sender Verification**
2. Add your sender email address
3. Click the verification link sent to that email

#### Option B: Domain Authentication (Recommended for Production)
1. Go to **Settings > Sender Authentication > Domain Authentication**
2. Add your domain (e.g., `yourcompany.com`)
3. Add the required DNS records (CNAME records for DKIM)
4. Wait for DNS propagation and verify

### 4. Configure Environment Variables

```bash
# .env
EMAIL_PROVIDER="sendgrid"
SENDGRID_API_KEY="SG.xxxxxxxxxxxxxxxxxxxx"  # Your API key
EMAIL_FROM_ADDRESS="noreply@yourcompany.com"  # Must be verified
EMAIL_FROM_NAME="BetterThanSpreadsheetsGRC"
```

### 5. Test the Configuration

Start the application and send a test email:

```typescript
import { emailService } from "@/server/services/email.service";

await emailService.sendEmail({
  to: "test@example.com",
  subject: "Test Email",
  html: "<h1>Hello!</h1><p>This is a test email.</p>"
});
```

---

## AWS SES Setup

### 1. Create an IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam)
2. Navigate to **Users > Add users**
3. Name: `ses-email-sender`
4. Access type: **Programmatic access**
5. Attach the policy: `AmazonSESFullAccess`
6. Create user and save the Access Key ID and Secret Access Key

### 2. Configure SES Region

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses)
2. Select your preferred region (e.g., `us-east-1`, `eu-west-1`)
3. Note the region code for configuration

### 3. Verify Sender Identity

#### Sandbox Mode (Testing)
In sandbox mode, you must verify both sender AND recipient emails:

1. Go to **SES > Identities > Create identity**
2. Choose **Email address**
3. Enter your sender email address
4. Click the verification link
5. Repeat for each test recipient email

#### Production Mode (Recommended)
To send to any recipient, request production access:

1. Go to **SES > Account dashboard**
2. Click **Request production access**
3. Fill out the form explaining your use case
4. Wait for approval (usually 24 hours)

#### Domain Verification (Best for Production)
For production, verify your entire domain:

1. Go to **SES > Identities > Create identity**
2. Choose **Domain**
3. Enter your domain (e.g., `yourcompany.com`)
4. Enable **DKIM** (recommended)
5. Add the required DNS records (CNAME for DKIM, TXT for verification)
6. Wait for DNS propagation and verification

### 4. Configure Environment Variables

```bash
# .env
EMAIL_PROVIDER="ses"
AWS_SES_REGION="us-east-1"  # Your SES region
AWS_SES_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SES_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
EMAIL_FROM_ADDRESS="noreply@yourcompany.com"  # Must be verified
EMAIL_FROM_NAME="BetterThanSpreadsheetsGRC"
```

### 5. Test the Configuration

Same as SendGrid test above.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_PROVIDER` | No | `console` | Email provider: `sendgrid`, `ses`, or `console` |
| `SENDGRID_API_KEY` | If sendgrid | - | SendGrid API key |
| `AWS_SES_REGION` | If ses | - | AWS region (e.g., `us-east-1`) |
| `AWS_SES_ACCESS_KEY_ID` | If ses | - | AWS IAM access key ID |
| `AWS_SES_SECRET_ACCESS_KEY` | If ses | - | AWS IAM secret access key |
| `EMAIL_FROM_ADDRESS` | If not console | - | Verified sender email address |
| `EMAIL_FROM_NAME` | No | `BetterThanSpreadsheetsGRC` | Sender display name |

---

## Troubleshooting

### SendGrid Issues

#### "Invalid API key"
- Verify the API key is correct and complete
- Ensure the key has "Mail Send" permission
- Check if the key was regenerated

#### "Sender identity not verified"
- Verify the sender email at Settings > Sender Authentication
- If using domain authentication, check DNS records are correct
- Allow time for DNS propagation (up to 48 hours)

#### "Quota exceeded"
- Check your SendGrid plan limits
- Request a limit increase or upgrade your plan

### AWS SES Issues

#### "Invalid credentials"
- Verify the Access Key ID and Secret are correct
- Check the IAM user has `AmazonSESFullAccess` policy
- Ensure the credentials haven't been deactivated

#### "Email address not verified" / "Sandbox mode"
- In sandbox mode, both sender AND recipient must be verified
- Request production access to send to unverified recipients

#### "Region not configured"
- Ensure `AWS_SES_REGION` matches where your SES is set up
- SES is regional; verify identities in the correct region

### Console Mode Issues

#### Emails not appearing in logs
- Check console output (not browser console)
- In Docker, use: `docker logs betterthanspreadsheetsGRC-app -f`

---

## Rate Limiting

The email service enforces a rate limit of **100 emails per minute** to prevent abuse. If you exceed this limit, you'll receive an error.

For bulk sending operations, consider:
1. Using a job queue (see Story 4.18)
2. Spreading sends over time
3. Requesting a higher limit from your email provider

---

## Email Logging and Auditing

All email sends are logged to the audit trail:

- **Successful sends**: Logged with `SEND_EMAIL` action
- **Failed sends**: Logged with `EMAIL_SEND_FAILED` action

Logged information includes:
- Recipient(s)
- Subject
- Provider used
- Message ID
- Timestamp
- Error details (for failures)

To query email logs, use the audit log API with `entityType: "Email"`.

---

## Security Best Practices

1. **Never commit credentials to git** - Use environment variables
2. **Rotate API keys periodically** - Every 90 days recommended
3. **Use domain authentication** - More secure than single sender verification
4. **Enable DKIM signing** - Improves deliverability and prevents spoofing
5. **Monitor sending reputation** - Check for bounces and complaints
6. **Use dedicated sending IPs** (if available) - Isolates your reputation

---

## Related Documentation

- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference)
- [AWS SES Developer Guide](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/)
- Story 4.15: Email Queue with Retry Logic
- Story 4.16: Email Templates for Risk Assignments
