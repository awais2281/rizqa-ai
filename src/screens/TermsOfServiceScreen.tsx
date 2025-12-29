import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface TermsOfServiceScreenProps {
  navigation: any;
}

export default function TermsOfServiceScreen({ navigation }: TermsOfServiceScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: 27/12/2026</Text>
        
        <Text style={styles.intro}>
          By using the mobile application "Rizqa" you agree to these Terms of Service. If you do not agree to these terms, please do not use the App.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Use of the App</Text>
          <Text style={styles.sectionText}>
            Rizqa is a habit and consistency app designed to be safe and appropriate for users of all ages.
          </Text>
          <Text style={styles.sectionText}>
            You agree to use the App only for its intended purpose and in a lawful manner. You must not misuse the App or attempt to interfere with its functionality.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. User Accounts</Text>
          <Text style={styles.sectionText}>
            To use certain features of the App, you may be required to create an account using an email address.
          </Text>
          <Text style={styles.sectionText}>
            You are responsible for maintaining the confidentiality of your account and for any activity that occurs under your account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Acceptable Use</Text>
          <Text style={styles.sectionText}>
            You agree not to:
          </Text>
          <Text style={styles.bulletPoint}>• Use the App for unlawful purposes</Text>
          <Text style={styles.bulletPoint}>• Attempt to access or modify the App's systems without authorization</Text>
          <Text style={styles.bulletPoint}>• Abuse, disrupt, or interfere with the App or its services</Text>
          <Text style={styles.sectionText}>
            We reserve the right to suspend or terminate accounts that violate these terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. AI Features</Text>
          <Text style={styles.sectionText}>
            Rizqa includes AI-powered features that respond to user input.
          </Text>
          <Text style={styles.bulletPoint}>• AI responses are provided for general informational or motivational purposes only</Text>
          <Text style={styles.bulletPoint}>• AI-generated content may not always be accurate or complete</Text>
          <Text style={styles.bulletPoint}>• You are responsible for how you use any information provided by the App</Text>
          <Text style={styles.bulletPoint}>• Rizqa is not responsible for actions taken based on AI-generated responses.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data and Privacy</Text>
          <Text style={styles.sectionText}>
            Your use of the App is also governed by our Privacy Policy, which explains how we collect and use information.
          </Text>
          <Text style={styles.sectionText}>
            By using Rizqa, you agree to the data practices described in the Privacy Policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Account Deletion</Text>
          <Text style={styles.sectionText}>
            You may delete your account at any time through the App settings.
          </Text>
          <Text style={styles.sectionText}>
            Upon deletion, your account and associated data will be permanently removed, subject to any legal obligations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Availability and Changes</Text>
          <Text style={styles.sectionText}>
            We may update, modify, or discontinue parts of the App at any time without notice.
          </Text>
          <Text style={styles.sectionText}>
            We do not guarantee that the App will always be available or error-free.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Disclaimer of Warranties</Text>
          <Text style={styles.sectionText}>
            Rizqa is provided "as is" and "as available".
          </Text>
          <Text style={styles.sectionText}>
            We make no warranties, express or implied, regarding the reliability, accuracy, or suitability of the App for any purpose.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
          <Text style={styles.sectionText}>
            To the maximum extent permitted by law, Rizqa shall not be liable for any damages arising from your use of the App, including but not limited to loss of data or interruption of service.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to These Terms</Text>
          <Text style={styles.sectionText}>
            We may update these Terms of Service from time to time. Changes will be posted on this page with an updated date.
          </Text>
          <Text style={styles.sectionText}>
            Continued use of the App after changes means you accept the updated terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Information</Text>
          <Text style={styles.sectionText}>
            If you have questions about these Terms of Service, you may contact us at:
          </Text>
          <Text style={styles.contactEmail}>rizqahelpteam@gmail.com</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1419',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  intro: {
    fontSize: 16,
    color: '#CCCCCC',
    lineHeight: 24,
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#CCCCCC',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 10,
  },
  contactEmail: {
    fontSize: 15,
    color: '#4A90E2',
    marginTop: 10,
    fontWeight: '600',
  },
});
