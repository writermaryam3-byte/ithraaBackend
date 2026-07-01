import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  name: string;
}

export const WelcomeEmailTemplate = ({
  name,
}: WelcomeEmailProps): React.JSX.Element => {
  return (
    <Html lang="ar" dir="rtl">
      <Head />
      <Preview>مرحباً بك في مجتمع إثراء الذكاء المتكامل ✨</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* الهيدر */}
          <Section style={logoContainer}>
            <Text style={logoText}>إثراء الذكاء</Text>
          </Section>

          <Section style={contentSection}>
            <Heading style={heading}>أهلاً بك يا {name} في عائلتنا! 👋</Heading>

            <Text style={text}>
              يسعدنا جداً انضمامك إلى مجتمع <strong>إثراء الذكاء</strong>{' '}
              الرقمي. نحن هنا لنكون بوابتك الذكية والموثوقة للربط بين الأسرة
              والمدرسة ومزودي الأنشطة.
            </Text>

            <Text style={text}>
              هدفنا الأساسي هو بناء بيئة حاضنة ومثالية تساعدك على اكتشاف ذكاءات
              الأطفال وميولهم الفردية عبر أحدث المقاييس العلمية وتوجيههم نحو
              شغفهم الحقيقي بثقة وتميز.
            </Text>

            {/* نقاط الانطلاق */}
            <Section style={perksBox}>
              <Text style={perkTitle}>
                💡 ما هي خطوتك التالية في لوحة التحكم؟
              </Text>
              <Text style={perkItem}>
                🔹 <strong>للأسر:</strong> أسس ملف طفلك وابدأ اختبارات الذكاء
                الفورية.
              </Text>
              <Text style={perkItem}>
                🔹 <strong>للمدارس:</strong> فعّل فصولك التعليمية وأسس شراكاتك
                الاستراتيجية.
              </Text>
              <Text style={perkItem}>
                🔹 <strong>للمزودين:</strong> أدرج برامجك وأنشطتك الإثرائية خارج
                المناهج.
              </Text>
            </Section>

            <Section style={btnContainer}>
              <Button
                style={button}
                href={`${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/dashboards`}
              >
                الانتقال إلى لوحة التحكم الخاصة بك
              </Button>
            </Section>

            <Text style={text}>
              نحن هنا دائماً لخدمتك ودعم رحلتك، إذا واجهتك أي استفسارات لا تتردد
              بالرد مباشرة على هذا البريد.
            </Text>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>
              منصة إثراء الذكاء · معاً نصنع مستقبلاً يكتشف فيه كل طفل تميزه
            </Text>
            <Text style={footerLinks}>
              <Link href="https://ithrathaka.com" style={linkStyle}>
                تصفح المنصة
              </Link>{' '}
              |{' '}
              <Link href="https://ithrathaka.com/privacy" style={linkStyle}>
                سياسة الخصوصية
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// تعريف صريح لنوع الستايل لمنع الـ Linter من قراءته كـ any/unsafe assignment
const main = {
  backgroundColor: '#f8fafc',
  fontFamily: 'Cairo, system-ui, sans-serif',
  padding: '40px 10px',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
};

const logoContainer = {
  background: 'linear-gradient(135deg, #7222e3 0%, #e88ecf 100%)',
  padding: '35px 30px',
  textAlign: 'center',
};

const logoText = {
  color: '#ffffff',
  fontSize: '26px',
  fontWeight: '900',
  margin: '0',
};

const contentSection = {
  padding: '40px 30px',
  textAlign: 'right',
};

const heading = {
  color: '#2b4683',
  fontSize: '22px',
  fontWeight: '800',
  marginBottom: '18px',
};

const text = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.6',
  marginBottom: '16px',
};

const perksBox = {
  backgroundColor: '#f3eefb',
  borderRight: '4px solid #7222e3',
  padding: '20px',
  borderRadius: '8px',
  margin: '25px 0',
};

const perkTitle = {
  color: '#2b4683',
  fontSize: '15px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const perkItem = {
  color: '#3a1379',
  fontSize: '13.5px',
  margin: '0 0 8px 0',
  lineHeight: '1.5',
};

const btnContainer = {
  textAlign: 'center',
  margin: '30px 0',
};

const button = {
  backgroundColor: '#2b4683',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
  padding: '14px 30px',
};

const footerSection = {
  backgroundColor: '#f1f5f9',
  padding: '24px 30px',
  textAlign: 'center',
};

const footerText = {
  color: '#64748b',
  fontSize: '11.5px',
  margin: '0 0 6px 0',
};

const footerLinks = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0',
};

const linkStyle = {
  color: '#2b4683',
  textDecoration: 'none',
  fontWeight: '600',
};
