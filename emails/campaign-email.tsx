import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Preview,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface CampaignEmailProps {
  body: string;
}

export const CampaignEmail = ({ body }: CampaignEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>A new message from Spacexer</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={bodySection}>
            <Text style={text}>
              {/* This replaces \n with <br/> to maintain line breaks from the textarea */}
              {body.split('\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
            </Text>
          </Section>
          
          <Hr style={hr} />
          
          <Section>
            <Text style={footer}>
              You are receiving this email because you opted in to updates from Spacexer.
              <br />
              © {new Date().getFullYear()} Spacexer. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default CampaignEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
  maxWidth: '600px',
};

const bodySection = {
  padding: '10px 0',
};

const text = {
  color: '#333333',
  fontSize: '16px',
  lineHeight: '24px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '30px 0',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
};
