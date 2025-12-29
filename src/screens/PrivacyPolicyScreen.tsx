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

interface PrivacyPolicyScreenProps {
  navigation: any;
}

export default function PrivacyPolicyScreen({ navigation }: PrivacyPolicyScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: 26/12/2025</Text>
        
        <Text style={styles.intro}>
          Rizqa is a simple habit and consistency app designed to be safe and appropriate for users of all ages. This Privacy Policy explains how we collect, use, and protect information when you use the Rizqa mobile application.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.sectionText}>
            We collect only the information necessary to operate the app:
          </Text>
          <Text style={styles.bulletPoint}>• Email address (used for account authentication)</Text>
          <Text style={styles.bulletPoint}>• Account identifiers</Text>
          <Text style={styles.bulletPoint}>• App usage data, such as streaks and in-app interactions</Text>
          <Text style={styles.bulletPoint}>• User input provided within the app when interacting with app features, including AI-powered functionality</Text>
          <Text style={styles.sectionText}>
            We do not collect sensitive personal information such as precise location, contacts, photos, or payment details.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Information</Text>
          <Text style={styles.sectionText}>
            The collected information is used only to:
          </Text>
          <Text style={styles.bulletPoint}>• Create and manage user accounts</Text>
          <Text style={styles.bulletPoint}>• Provide core app functionality</Text>
          <Text style={styles.bulletPoint}>• Power AI-based features requested by the user</Text>
          <Text style={styles.bulletPoint}>• Maintain and improve app reliability and performance</Text>
          <Text style={styles.sectionText}>
            We do not use personal data for advertising or marketing purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. AI Features</Text>
          <Text style={styles.sectionText}>
            Rizqa includes AI-powered features that respond to user input.
          </Text>
          <Text style={styles.bulletPoint}>• User input may be sent to an external AI service solely to generate responses requested by the user.</Text>
          <Text style={styles.bulletPoint}>• AI interactions are not used for profiling</Text>
          <Text style={styles.bulletPoint}>• Inputs are not used for advertising</Text>
          <Text style={styles.bulletPoint}>• Data is processed only to provide the requested functionality</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Audio & Microphone Access</Text>
          <Text style={styles.sectionText}>
            Our app may request access to your device's microphone to enable voice-related features within the app.
          </Text>
          <Text style={styles.sectionText}>
            Audio input is used only to provide the intended functionality (such as voice input or audio interaction). Audio data is not stored, not recorded, and not shared with third parties. Any audio captured is processed temporarily and discarded immediately after use.
          </Text>
          <Text style={styles.sectionText}>
            Microphone access is optional and can be disabled at any time through your device's system settings. The app continues to function, with limited features, if microphone access is denied.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Third-Party Services</Text>
          <Text style={styles.sectionText}>
            Rizqa uses the following service providers to operate the app:
          </Text>
          <Text style={styles.bulletPoint}>• Supabase – authentication and database services</Text>
          <Text style={styles.bulletPoint}>• Railway – backend server hosting</Text>
          <Text style={styles.bulletPoint}>• AI service providers – to generate AI-powered responses based on user input</Text>
          <Text style={styles.sectionText}>
            These services process data only on our behalf and are required to protect user data in accordance with applicable data protection standards.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Data Sharing</Text>
          <Text style={styles.bulletPoint}>• We do not sell, rent, or trade personal data.</Text>
          <Text style={styles.bulletPoint}>• Data is shared only with service providers strictly as necessary to operate the app.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Data Security</Text>
          <Text style={styles.sectionText}>
            We use industry-standard security measures, including encrypted connections, to protect user information. While no method of transmission is 100% secure, we take reasonable steps to safeguard data.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={styles.sectionText}>
            Rizqa is designed to be safe for children and does not contain harmful or inappropriate content.
          </Text>
          <Text style={styles.sectionText}>
            We do not knowingly collect personal information beyond what is necessary to provide the app's functionality. If a parent or guardian believes that their child has provided personal information and wishes it to be removed, they may contact us using the information below.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Account Deletion</Text>
          <Text style={styles.bulletPoint}>• Users can delete their account at any time from within the app settings.</Text>
          <Text style={styles.bulletPoint}>• When an account is deleted, associated data is permanently removed from our systems.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Changes to This Privacy Policy</Text>
          <Text style={styles.sectionText}>
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Contact Us</Text>
          <Text style={styles.sectionText}>
            If you have any questions about this Privacy Policy or data practices, you can contact us at:
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

