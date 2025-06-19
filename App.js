import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Keyboard,
  SafeAreaView,
  Platform,
  Image,
  Linking,
  Modal
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import fetchWebpageContent from './proxy_service';

// Theme configuration
const lightTheme = {
  background: '#ffffff',
  cardBackground: '#f8f9fa',
  text: '#212529',
  textSecondary: '#6c757d',
  border: '#dee2e6',
  primary: '#0A84FF',
  secondary: '#5856D6',
  accent: '#FF2D55',
  success: '#34C759',
  error: '#FF3B30',
  selectedButton: '#FF3B30',
  saveButton: '#28a745',
  inputBackground: '#ffffff',
  inputText: '#212529',
  inputPlaceholder: '#6c757d',
  buttonBackground: '#0A84FF',
  buttonText: '#ffffff',
  disabledButton: '#e9ecef',
  disabledText: '#adb5bd',
  headerBackground: '#ffffff',
};

// Search filtering constants
const EXCLUDED_DOMAINS = ["youtube.com", "arxiv.org", "quora.com", "github.com"];
const EXCLUDED_EXTENSIONS = [".pdf"];

// Google search function for health information
async function googleSearch(query, numResults = 3, serpapiKey) {
  const results = [];
  const uniqueDomains = new Set();

  try {
    const searchQuery = encodeURIComponent(`food prohibited in ${query}`);
    const url = `https://serpapi.com/search.json?engine=google&q=${searchQuery}&api_key=${serpapiKey}&num=10`;

    const response = await fetch(url);
    const data = await response.json();

    if (data && data.organic_results && data.organic_results.length > 0) {
      for (const result of data.organic_results) {
        if (!result.link) continue;
        
        const url = result.link;
        const domain = new URL(url).hostname.replace('www.', '');

        if (
          !EXCLUDED_DOMAINS.some(d => domain.includes(d)) &&
          !EXCLUDED_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext)) &&
          !uniqueDomains.has(domain)
        ) {
          const content = await fetchWebpageContent(url);
          
          results.push({
            url,
            title: result.title || 'No title available',
            description: result.snippet || 'No description available',
            content: content
          });
          uniqueDomains.add(domain);

          if (results.length >= numResults) break;
        }
      }
    }

    // Try alternative search if insufficient results
    if (results.length < numResults) {
      const alternativeQuery = encodeURIComponent(`foods to avoid with ${query}`);
      const alternativeUrl = `https://serpapi.com/search.json?engine=google&q=${alternativeQuery}&api_key=${serpapiKey}&num=10`;

      const alternativeResponse = await fetch(alternativeUrl);
      const alternativeData = await alternativeResponse.json();

      if (alternativeData && alternativeData.organic_results && alternativeData.organic_results.length > 0) {
        for (const result of alternativeData.organic_results) {
          if (results.length >= numResults) break;
          if (!result.link) continue;
          
          const url = result.link;
          const domain = new URL(url).hostname.replace('www.', '');

          if (
            !EXCLUDED_DOMAINS.some(d => domain.includes(d)) &&
            !EXCLUDED_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext)) &&
            !uniqueDomains.has(domain)
          ) {
            const content = await fetchWebpageContent(url);
            
            results.push({
              url,
              title: result.title || 'No title available',
              description: result.snippet || 'No description available',
              content: content
            });
            uniqueDomains.add(domain);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in Google search:', error.message);
  }

  return results;
}

// Debug function to view saved search results
const viewSavedSearchResults = async (userID) => {
  try {
    const savedData = await AsyncStorage.getItem(`search_${userID}`);
    
    if (savedData) {
      const data = JSON.parse(savedData);
      console.log('Search Results Summary:');
      console.log(`Total conditions: ${data.total_conditions}, Successful: ${data.successful_searches}`);
      console.log(`Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
      
      data.search_results.forEach((result, index) => {
        console.log(`Condition ${index + 1}: ${result.condition} (${result.type}) - ${result.status}`);
      });
    } else {
      console.log('No saved search results found');
    }
  } catch (error) {
    console.error('Error loading saved search results:', error);
  }
};

// Text parsing and formatting functions
const parseAnalysisText = (text) => {
  if (!text) return [];
  
  // Split text into sections based on numbered sections or clear section markers
  const sections = [];
  let currentSection = { title: '', content: [] };
  
  const lines = text.split('\n').filter(line => line.trim());
  
  for (let line of lines) {
    const trimmedLine = line.trim();
    
    // Detect section headers
    if (
      /^\d+\.\s/.test(trimmedLine) ||
      /^(good|bad|benefits?|drawbacks?|health|ingredients?|analysis|product|name|type|claims?|concerns?|recommendations?|summary):/i.test(trimmedLine) ||
      /^(what.*(good|bad)|if there is any difference|clearly tell)/i.test(trimmedLine)
    ) {
      // Save previous section
      if (currentSection.title && currentSection.content.length > 0) {
        sections.push({ ...currentSection });
      }
      
      // Start new section
      currentSection = {
        title: trimmedLine.replace(/^\d+\.\s*/, ''), // Remove numbering
        content: []
      };
    } else if (trimmedLine) {
      // Add to current section content
      currentSection.content.push(trimmedLine);
    }
  }
  
  // Add the last section
  if (currentSection.title && currentSection.content.length > 0) {
    sections.push(currentSection);
  }
  
  // If no clear sections found, treat as single section
  if (sections.length === 0 && lines.length > 0) {
    sections.push({
      title: 'Analysis',
      content: lines
    });
  }
  
  return sections;
};

const extractURLs = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

const formatTextWithLinks = (text) => {
  const parts = [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let lastIndex = 0;
  let match;
  
  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Add URL
    parts.push({
      type: 'link',
      content: match[0],
      url: match[0]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  // If no URLs found, return as single text part
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: text
    });
  }
  
  return parts;
};

const renderFormattedText = (text, style) => {
  const parts = formatTextWithLinks(text);
  
  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <Text
              key={index}
              style={[style, styles.linkText]}
              onPress={() => Linking.openURL(part.url)}
            >
              {part.content}
            </Text>
          );
        } else {
          return (
            <Text key={index} style={style}>
              {part.content}
            </Text>
          );
        }
      })}
    </Text>
  );
};

const renderBulletPoints = (content) => {
  return content.map((item, index) => (
    <View key={index} style={styles.bulletPointContainer}>
      <Text style={styles.bulletPoint}>•</Text>
      <View style={styles.bulletContent}>
        {renderFormattedText(item, styles.bulletText)}
      </View>
    </View>
  ));
};

export default function App() {
  // Date and Age States
  const [dateOfBirth, setDateOfBirth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [age, setAge] = useState(null);
  const [ageDetails, setAgeDetails] = useState(null);
  
  // Profile Management States
  const [userID, setUserID] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile Data States
  const [gender, setGender] = useState('Male');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState('KG');
  const [height, setHeight] = useState('');
  const [heightUnit, setHeightUnit] = useState('cm');
  const [foodAllergy, setFoodAllergy] = useState('');
  const [existingDisease, setExistingDisease] = useState('');
  const [otherHealthCondition, setOtherHealthCondition] = useState('');
  
  // Profile Storage States
  const [savedProfile, setSavedProfile] = useState(null);
  const [originalProfileData, setOriginalProfileData] = useState(null);
  
  // Navigation State
  const [currentPage, setCurrentPage] = useState('home'); // 'home', 'profile', 'loadProfile', 'deleteProfile', 'foodAnalysis'
  
  // Delete Profile States
  const [allProfiles, setAllProfiles] = useState([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Load profiles when delete profile page is accessed
  useEffect(() => {
    if (currentPage === 'deleteProfile') {
      loadAllProfiles();
    }
  }, [currentPage]);

  // Initialize app data and API keys
  useEffect(() => {
    checkFirstRunAndClearData();
    checkApiKeys();
  }, []);

  // Show settings modal when API keys missing
  useEffect(() => {
    if (!apiKeysConfigured && !showSettings) {
      setShowSettings(true);
    }
  }, [apiKeysConfigured]);

  const checkFirstRunAndClearData = async () => {
    try {
      const isFirstRun = await AsyncStorage.getItem('app_first_run');
      
      if (isFirstRun === null) {
        // Clear all existing data on first run
        await AsyncStorage.clear();
        await AsyncStorage.setItem('app_first_run', 'false');
        setIsFirstLaunch(true);
      }
    } catch (error) {
      console.error('Error checking first run:', error);
    }
  };

  const checkApiKeys = async () => {
    try {
      const openaiKey = await AsyncStorage.getItem('api_key_openai');
      const serpapiKey = await AsyncStorage.getItem('api_key_serpapi');
      
      if (openaiKey && serpapiKey) {
        setApiKeys({
          openai: openaiKey,
          serpapi: serpapiKey
        });
        setApiKeysConfigured(true);
      } else {
        setApiKeysConfigured(false);
        // Settings will be shown via useEffect
      }
    } catch (error) {
      console.error('Error checking API keys:', error);
      setApiKeysConfigured(false);
      // Settings will be shown via useEffect
    }
  };

  const saveApiKeys = async (openaiKey, serpapiKey) => {
    try {
      await AsyncStorage.setItem('api_key_openai', openaiKey);
      await AsyncStorage.setItem('api_key_serpapi', serpapiKey);
      
      setApiKeys({
        openai: openaiKey,
        serpapi: serpapiKey
      });
      setApiKeysConfigured(true);
      setShowSettings(false);
      
      if (isFirstLaunch) {
        Alert.alert(
          'Welcome!',
          'API keys configured successfully! You can now create your profile to get started with the Food Ingredients Analyzer.',
          [{ text: 'OK', style: 'default' }]
        );
        setIsFirstLaunch(false);
      } else {
        Alert.alert('Success', 'API keys updated successfully!');
      }
    } catch (error) {
      console.error('Error saving API keys:', error);
      Alert.alert('Error', 'Failed to save API keys. Please try again.');
    }
  };

  const testApiKeys = async (openaiKey, serpapiKey) => {
    setIsTestingKeys(true);
    
    try {
      // Test OpenAI API with a simple completion
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 5
        })
      });

      const openaiData = await openaiResponse.json();
      
      if (!openaiResponse.ok) {
        throw new Error(`OpenAI API error: ${openaiData.error?.message || 'Invalid API key'}`);
      }

      // Test SerpAPI with a simple search
      const serpapiResponse = await fetch(`https://serpapi.com/search.json?engine=google&q=test&api_key=${serpapiKey}&num=1`);
      const serpapiData = await serpapiResponse.json();
      
      if (!serpapiResponse.ok || serpapiData.error) {
        throw new Error(`SerpAPI error: ${serpapiData.error || 'Invalid API key'}`);
      }

      Alert.alert('Success', 'Both API keys are valid!');
      return true;
    } catch (error) {
      Alert.alert('Error', `API key validation failed: ${error.message}`);
      return false;
    } finally {
      setIsTestingKeys(false);
    }
  };

  const checkIfAnyProfileExists = async () => {
    try {
      const userIds = await getAllUserIDs();
      return userIds.length > 0;
    } catch (error) {
      console.error('Error checking for existing profiles:', error);
      return false;
    }
  };

  const handleFoodAnalyzerNavigation = async () => {
    // Verify API keys are configured
    if (!apiKeysConfigured) {
      Alert.alert(
        'API Keys Required', 
        'Please configure your API keys in Settings first.',
        [
          {
            text: 'OK',
            style: 'default',
            onPress: () => setShowSettings(true)
          }
        ]
      );
      return;
    }

    const hasProfiles = await checkIfAnyProfileExists();
    
    if (!hasProfiles) {
      Alert.alert(
        'Profile Required',
        'You need to create at least one profile before using the Food Analyzer. Please create your profile first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Create Profile', 
            style: 'default',
            onPress: () => {
              resetProfileForm();
              setCurrentPage('profile');
            }
          }
        ]
      );
      return;
    }

    if (!savedProfile) {
      Alert.alert(
        'Load Profile First',
        'Please load your profile before using the Food Analyzer.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Load Profile', 
            style: 'default',
            onPress: () => setCurrentPage('loadProfile')
          }
        ]
      );
      return;
    }

    setCurrentPage('foodAnalysis');
  };

  // Database Functions
  const saveProfileToDatabase = async (userID, profileData) => {
    try {
      const key = `profile_${userID}`;
      await AsyncStorage.setItem(key, JSON.stringify(profileData));
      return true;
    } catch (error) {
      console.error('Error saving profile to database:', error);
      return false;
    }
  };

  const loadProfileFromDatabase = async (userID) => {
    try {
      const key = `profile_${userID}`;
      const profileData = await AsyncStorage.getItem(key);
      if (profileData) {
        return JSON.parse(profileData);
      }
      return null;
    } catch (error) {
      console.error('Error loading profile from database:', error);
      return null;
    }
  };

  const checkUserExists = async (userID) => {
    try {
      const key = `profile_${userID}`;
      const profileData = await AsyncStorage.getItem(key);
      return profileData !== null;
    } catch (error) {
      console.error('Error checking if user exists:', error);
      return false;
    }
  };

  const getAllUserIDs = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys
        .filter(key => key.startsWith('profile_'))
        .map(key => key.replace('profile_', ''));
    } catch (error) {
      console.error('Error getting all user IDs:', error);
      return [];
    }
  };

  const deleteProfileFromDatabase = async (userID) => {
    try {
      const key = `profile_${userID}`;
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error deleting profile from database:', error);
      return false;
    }
  };

  // Input Validation
  const isValidHealthInput = (text) => {
    return /^[a-zA-Z0-9\s,.-]*$/.test(text);
  };

  // Age Calculation
  const calculateAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    const months = monthDiff < 0 ? 12 + monthDiff : monthDiff;
    const days = today.getDate() - birthDate.getDate();
    
    return {
      years: age,
      months: months,
      days: days
    };
  };

  // Add image states
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState('back'); // 'front' or 'back'
  const [currentPhotoType, setCurrentPhotoType] = useState(''); // 'front' or 'back' - refers to package side
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState(null);
  const [capturedImageUri, setCapturedImageUri] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // API Key Management states
  const [apiKeys, setApiKeys] = useState({
    openai: '',
    serpapi: ''
  });
  const [apiKeysConfigured, setApiKeysConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [isTestingKeys, setIsTestingKeys] = useState(false);

  // Profile Management Functions
  const saveProfile = async () => {
    try {
      if (!userID) {
        Alert.alert('Error', 'Please enter your email address');
        return;
      }

      // Validate profile uniqueness
      const existingProfile = await AsyncStorage.getItem(`profile_${userID}`);
      if (existingProfile && !isEditingProfile) {
        Alert.alert('Error', 'A profile with this User ID already exists. Please use a different User ID or edit the existing profile.');
        return;
      }


      setIsSaving(true);

      // For update profile, check if there are any changes
      if (isEditingProfile) {
        const hasChanges = hasProfileChanged();
        
        if (!hasChanges) {
          // No changes detected
          setIsSaving(false);
          Alert.alert(
            'Profile Updated',
            'Profile updated successfully!',
            [
              { text: 'OK', style: 'default' },
              { 
                text: 'Go to Food Analyzer', 
                style: 'default',
                onPress: () => setCurrentPage('foodAnalysis')
              }
            ]
          );
          return;
        }
      }
      const profileData = {
        userID,
        dateOfBirth: dateOfBirth.toISOString(),
        age,
        gender,
        weight: weight + (weightUnit === 'lbs' ? ' lbs' : ' kg'),
        height: height + (heightUnit === 'ft' ? ' ft' : ' cm'),
        foodAllergy,
        existingDisease,
        otherHealthCondition,
        lastUpdated: new Date().toISOString()
      };

      console.log('\n💾 Saving profile data:', profileData);
      await AsyncStorage.setItem(`profile_${userID}`, JSON.stringify(profileData));

      // Determine if web scraping is needed
      let shouldPerformWebScraping = true;
      if (isEditingProfile && savedProfile) {
        shouldPerformWebScraping = 
          (savedProfile.foodAllergy || '').trim() !== foodAllergy.trim() ||
          (savedProfile.existingDisease || '').trim() !== existingDisease.trim() ||
          (savedProfile.otherHealthCondition || '').trim() !== otherHealthCondition.trim();
      }

      // Perform web scraping for health conditions
      const searchResults = [];
      let totalContent = '';

      async function processList(list, type, suffix = '') {
        if (!list || !list.trim()) return;
        
        const items = list.split(',').map(s => s.trim()).filter(Boolean);
        
        for (const item of items) {
          try {
            const results = await googleSearch(item + suffix, 3, apiKeys.serpapi);
            
            const searchResult = {
              condition: item,
              type,
              results,
              status: 'success'
            };
            
            searchResults.push(searchResult);
            totalContent += `Current ${type}: ${item}\n\n`;
            results.forEach(result => {
              totalContent += `Title: ${result.title}\n`;
              totalContent += `URL: ${result.url}\n`;
              totalContent += `Description: ${result.description}\n`;
              totalContent += `Content: ${result.content}\n\n`;
            });
          } catch (err) {
            searchResults.push({
              condition: item,
              type,
              results: [],
              status: 'error'
            });
          }
        }
      }

      // Only perform web scraping if needed
      if (shouldPerformWebScraping) {
        // Process each type of condition
        await processList(existingDisease, 'disease');
        await processList(otherHealthCondition, 'condition');
        await processList(foodAllergy, 'allergy', ' allergy');

        // Save search results
        const searchData = {
          success: true,
          total_content: totalContent,
          search_results: searchResults,
          total_conditions: searchResults.length,
          successful_searches: searchResults.filter(r => r.status === 'success').length,
          timestamp: Date.now()
        };

        await AsyncStorage.setItem(`search_${userID}`, JSON.stringify(searchData));
      }

      // Show appropriate popup based on profile type
      if (isEditingProfile) {
        Alert.alert(
          'Profile Updated',
          'Profile updated successfully!',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Go to Food Analyzer', 
              style: 'default',
              onPress: () => setCurrentPage('foodAnalysis')
            }
          ]
        );
      } else {
        // Show health profile summary popup for new profiles
        Alert.alert(
          'Health Profile Summary',
          `User ID: ${userID}\nAge: ${age} years\nGender: ${gender}\nWeight: ${weight} ${weightUnit}\nHeight: ${height} ${heightUnit}\n\nFood Allergies: ${foodAllergy || 'None'}\nExisting Diseases: ${existingDisease || 'None'}\nOther Health Conditions: ${otherHealthCondition || 'None'}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setCurrentPage('foodAnalysis');
              }
            }
          ]
        );
      }

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      const ageInfo = calculateAge(selectedDate);
      setAge(ageInfo.years);
      setAgeDetails(ageInfo);
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const hasProfileChanged = () => {
    if (!savedProfile) return true;
    
    // Compare all profile fields
    const currentWeight = parseFloat(weight);
    const currentHeight = parseFloat(height);
    const savedWeight = typeof savedProfile.weight === 'string' ? 
      parseFloat(savedProfile.weight.replace(/[^\d.]/g, '')) : savedProfile.weight;
    const savedHeight = typeof savedProfile.height === 'string' ? 
      parseFloat(savedProfile.height.replace(/[^\d.]/g, '')) : savedProfile.height;
    
  return (
      savedProfile.dateOfBirth !== dateOfBirth.toISOString() ||
      savedProfile.gender !== gender ||
      savedWeight !== currentWeight ||
      savedProfile.weightUnit !== weightUnit ||
      savedHeight !== currentHeight ||
      savedProfile.heightUnit !== heightUnit ||
      (savedProfile.foodAllergy || '').trim() !== foodAllergy.trim() ||
      (savedProfile.existingDisease || '').trim() !== existingDisease.trim() ||
      (savedProfile.otherHealthCondition || '').trim() !== otherHealthCondition.trim()
    );
  };

  const loadExistingProfile = async () => {
    if (!userID.trim()) {
      Alert.alert('Error', 'Please enter a User ID');
      return;
    }

    setIsLoadingProfile(true);
    const profileData = await loadProfileFromDatabase(userID);
    
    if (profileData) {
      setDateOfBirth(new Date(profileData.dateOfBirth));
      setGender(profileData.gender);
      setWeight(profileData.weight.toString());
      setWeightUnit(profileData.weightUnit);
      setHeight(profileData.height.toString());
      setHeightUnit(profileData.heightUnit);
      setFoodAllergy(profileData.foodAllergy);
      setExistingDisease(profileData.existingDisease);
      setOtherHealthCondition(profileData.otherHealthCondition);
      setSavedProfile(profileData);
      setOriginalProfileData(profileData);
      setIsEditingProfile(true);
      
      const ageInfo = calculateAge(new Date(profileData.dateOfBirth));
      setAge(ageInfo.years);
      setAgeDetails(ageInfo);

      // Show 3-option popup after loading profile
      Alert.alert(
        'Profile Loaded Successfully',
        `User ID: ${userID}\nAge: ${ageInfo.years} years\nGender: ${profileData.gender}\nWeight: ${profileData.weight}\nHeight: ${profileData.height}\n\nFood Allergies: ${profileData.foodAllergy || 'None'}\nExisting Diseases: ${profileData.existingDisease || 'None'}\nOther Health Conditions: ${profileData.otherHealthCondition || 'None'}`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              // Reset form and go back to home
              resetProfileForm();
              setCurrentPage('home');
            }
          },
          {
            text: 'Edit Profile',
            onPress: () => setCurrentPage('profile')
          },
          {
            text: 'Go to Food Analyzer',
            onPress: () => setCurrentPage('foodAnalysis')
          }
        ]
      );
    } else {
      Alert.alert('Error', 'Profile not found');
    }
    setIsLoadingProfile(false);
  };

  const loadAllProfiles = async () => {
    try {
      setIsLoadingProfiles(true);
      const allKeys = await AsyncStorage.getAllKeys();
      const profileKeys = allKeys.filter(key => key.startsWith('profile_'));
      
      const profiles = await Promise.all(
        profileKeys.map(async (key) => {
          const profileData = await AsyncStorage.getItem(key);
          return profileData ? JSON.parse(profileData) : null;
        })
      );

      // Filter out any empty or invalid profiles
      const validProfiles = profiles.filter(profile => 
        profile && 
        profile.userID && 
        profile.age && 
        profile.gender
      );
      
      setAllProfiles(validProfiles);
    } catch (error) {
      console.error('Error loading profiles:', error);
      setAllProfiles([]);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleDeleteProfile = async (userID) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete profile ${userID}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteProfileFromDatabase(userID);
            if (success) {
              await loadAllProfiles();
              Alert.alert('Success', 'Profile deleted successfully');
            } else {
              Alert.alert('Error', 'Failed to delete profile');
            }
          }
        }
      ]
    );
  };

  const resetProfileForm = () => {
    setUserID('');
    setDateOfBirth(new Date());
    setGender('Male');
    setWeight('');
    setWeightUnit('KG');
    setHeight('');
    setHeightUnit('cm');
    setFoodAllergy('');
    setExistingDisease('');
    setOtherHealthCondition('');
    setSavedProfile(null);
    setOriginalProfileData(null);
    setIsEditingProfile(false);
    setAge(null);
    setAgeDetails(null);
  };

  // UI Components
  const renderHomePage = () => (
    <ScrollView style={styles.homeContainer} contentContainerStyle={styles.homeContent}>
      <View style={styles.headerSection}>
        <View style={styles.headerWithSettings}>
          <View style={styles.headerText}>
            <Text style={styles.title}>🔍 Food Ingredients Analyzer</Text>
            <Text style={styles.subtitle}>Personalized Health-Based Food Analysis</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsIcon}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsIconText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.sectionsContainer}>
        {/* Food Analyzer Section */}
        <TouchableOpacity 
          style={[styles.sectionCard, styles.foodAnalyzerCard]} 
          onPress={handleFoodAnalyzerNavigation}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.iconContainer}>
              <Text style={styles.sectionIcon}>🔬</Text>
            </View>
            <Text style={styles.sectionTitle}>Food Analyzer</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Take photos of food packages and analyze ingredients for health impact
      </Text>
          <View style={styles.sectionFooter}>
            <Text style={styles.sectionAction}>Analyze Food →</Text>
          </View>
        </TouchableOpacity>

        {/* Create New Profile Section */}
        <TouchableOpacity 
          style={styles.sectionCard} 
          onPress={() => { resetProfileForm(); setCurrentPage('profile'); }}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.iconContainer}>
              <Text style={styles.sectionIcon}>➕</Text>
            </View>
            <Text style={styles.sectionTitle}>Create New Profile</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Set up a new health profile with your medical conditions and food allergies
      </Text>
          <View style={styles.sectionFooter}>
            <Text style={styles.sectionAction}>Get Started →</Text>
    </View>
        </TouchableOpacity>

        {/* Load Profile Section */}
        <TouchableOpacity 
          style={styles.sectionCard} 
          onPress={() => setCurrentPage('loadProfile')}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.iconContainer}>
              <Text style={styles.sectionIcon}>📂</Text>
            </View>
            <Text style={styles.sectionTitle}>Load Existing Profile</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Load and edit your saved health profile to update your information
          </Text>
          <View style={styles.sectionFooter}>
            <Text style={styles.sectionAction}>Load Profile →</Text>
          </View>
        </TouchableOpacity>

        {/* Delete Profile Section */}
        <TouchableOpacity 
          style={styles.sectionCard} 
          onPress={() => setCurrentPage('deleteProfile')}
        >
          <View style={styles.sectionHeader}>
            <View style={styles.iconContainer}>
              <Text style={styles.sectionIcon}>🗑️</Text>
            </View>
            <Text style={styles.sectionTitle}>Delete Profile</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Remove unwanted health profiles. This action cannot be undone
          </Text>
          <View style={styles.sectionFooter}>
            <Text style={styles.sectionAction}>Manage Profiles →</Text>
          </View>
        </TouchableOpacity>
      </View>
      
    </ScrollView>
  );

  const renderDeleteProfilePage = () => (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentPage('home')}
        >
          <Text style={styles.backButtonText}>🏠 Home</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Delete Profile</Text>
      </View>

      {/* Scrollable Content */}
      <KeyboardAwareScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraHeight={100}
        extraScrollHeight={100}
        keyboardOpeningTime={0}
      >
        {isLoadingProfiles ? (
          <Text style={styles.loadingText}>Loading profiles...</Text>
        ) : allProfiles.length === 0 ? (
          <Text style={styles.noProfilesText}>No profiles found</Text>
        ) : (
          <View style={styles.profilesList}>
            {allProfiles.map((profile, index) => (
              <View key={index} style={styles.profileItem}>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileUserID}>{profile.userID}</Text>
                  <Text style={styles.profileDetails}>
                    Age: {profile.age} | Gender: {profile.gender}
                  </Text>
                  <Text style={styles.profileDate}>
                    Last updated: {new Date(profile.lastUpdated).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteProfile(profile.userID)}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );

  const renderLoadProfilePage = () => (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentPage('home')}
        >
          <Text style={styles.backButtonText}>🏠 Home</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Load Existing Profile</Text>
      </View>

      {/* Scrollable Content */}
      <KeyboardAwareScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraHeight={100}
        extraScrollHeight={100}
        keyboardOpeningTime={0}
      >
        <View style={styles.inputContainer}>
          <Text style={styles.label}>User ID (Email Address)</Text>
          <Text style={styles.sublabel}>Enter the email address of the profile you want to load</Text>
          <TextInput
            style={styles.input}
            value={userID}
            onChangeText={setUserID}
            placeholder="Enter email address"
            placeholderTextColor={lightTheme.inputPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoadingProfile && styles.buttonDisabled]}
          onPress={loadExistingProfile}
          disabled={isLoadingProfile}
        >
          <Text style={styles.buttonText}>
            {isLoadingProfile ? 'Loading...' : 'Load Profile'}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );

  const renderProfilePage = () => (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentPage('home')}
        >
          <Text style={styles.backButtonText}>🏠 Home</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>{isEditingProfile ? 'Update Your Profile' : 'Create New Profile'}</Text>
      </View>

      {/* Scrollable Content */}
      <KeyboardAwareScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraHeight={100}
        extraScrollHeight={100}
        keyboardOpeningTime={0}
      >
        {/* User ID Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>User ID (Email Address)</Text>
          <Text style={styles.sublabel}>Enter your email address as your unique identifier</Text>
          <TextInput
            style={[styles.input, isEditingProfile && styles.inputDisabled]}
            value={userID}
            onChangeText={setUserID}
            placeholder="Enter your email address"
            placeholderTextColor={lightTheme.inputPlaceholder}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isEditingProfile}
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Date of Birth</Text>
          <Text style={styles.sublabel}>Select your date of birth to calculate age</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>{formatDate(dateOfBirth)}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}
          {age !== null && (
            <View style={styles.ageDisplay}>
              <Text style={styles.ageText}>Age: {age} years</Text>
              {ageDetails && (
                <Text style={styles.ageDetailsText}>
                  Exactly: {ageDetails.years} years, {ageDetails.months} months, {ageDetails.days} days
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Gender Selection */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Gender</Text>
          <Text style={styles.sublabel}>Select your gender</Text>
          <View style={styles.genderContainer}>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === 'Male' && styles.genderButtonSelected
              ]}
              onPress={() => setGender('Male')}
            >
              <Text style={[
                styles.genderButtonText,
                gender === 'Male' && styles.genderButtonTextSelected
              ]}>Male</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === 'Female' && styles.genderButtonSelected
              ]}
              onPress={() => setGender('Female')}
            >
              <Text style={[
                styles.genderButtonText,
                gender === 'Female' && styles.genderButtonTextSelected
              ]}>Female</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.genderButton,
                gender === 'Other' && styles.genderButtonSelected
              ]}
              onPress={() => setGender('Other')}
            >
              <Text style={[
                styles.genderButtonText,
                gender === 'Other' && styles.genderButtonTextSelected
              ]}>Other</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weight Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Weight</Text>
          <Text style={styles.sublabel}>Enter your current weight</Text>
          <View style={styles.measurementContainer}>
            <TextInput
              style={[styles.input, styles.measurementInput]}
              value={weight}
              onChangeText={setWeight}
              placeholder="Enter weight"
              placeholderTextColor={lightTheme.inputPlaceholder}
              keyboardType="numeric"
            />
            <View style={styles.unitContainer}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  weightUnit === 'KG' && styles.unitButtonSelected
                ]}
                onPress={() => setWeightUnit('KG')}
              >
                <Text style={[
                  styles.unitButtonText,
                  weightUnit === 'KG' && styles.unitButtonTextSelected
                ]}>KG</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  weightUnit === 'lbs' && styles.unitButtonSelected
                ]}
                onPress={() => setWeightUnit('lbs')}
              >
                <Text style={[
                  styles.unitButtonText,
                  weightUnit === 'lbs' && styles.unitButtonTextSelected
                ]}>lbs</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Height Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Height</Text>
          <Text style={styles.sublabel}>Enter your current height</Text>
          <View style={styles.measurementContainer}>
            <TextInput
              style={[styles.input, styles.measurementInput]}
              value={height}
              onChangeText={setHeight}
              placeholder="Enter height"
              placeholderTextColor={lightTheme.inputPlaceholder}
              keyboardType="numeric"
            />
            <View style={styles.unitContainer}>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  heightUnit === 'cm' && styles.unitButtonSelected
                ]}
                onPress={() => setHeightUnit('cm')}
              >
                <Text style={[
                  styles.unitButtonText,
                  heightUnit === 'cm' && styles.unitButtonTextSelected
                ]}>cm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitButton,
                  heightUnit === 'inch' && styles.unitButtonSelected
                ]}
                onPress={() => setHeightUnit('inch')}
              >
                <Text style={[
                  styles.unitButtonText,
                  heightUnit === 'inch' && styles.unitButtonTextSelected
                ]}>inch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Food Allergies */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Food Allergies</Text>
          <Text style={styles.sublabel}>Enter allergies separated by commas (e.g., peanuts, dairy, shellfish)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={foodAllergy}
            onChangeText={setFoodAllergy}
            placeholder="Enter your food allergies (If none, leave blank)"
            placeholderTextColor={lightTheme.inputPlaceholder}
            multiline={true}
            numberOfLines={3}
          />
        </View>

        {/* Existing Diseases */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Existing Diseases</Text>
          <Text style={styles.sublabel}>Enter diseases separated by commas (e.g., diabetes, hypertension)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={existingDisease}
            onChangeText={setExistingDisease}
            placeholder="Enter your existing diseases (If none, leave blank)"
            placeholderTextColor={lightTheme.inputPlaceholder}
            multiline={true}
            numberOfLines={3}
          />
        </View>

        {/* Other Health Conditions */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Other Health Conditions</Text>
          <Text style={styles.sublabel}>Enter conditions separated by commas (e.g., lactose intolerance, high cholesterol)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={otherHealthCondition}
            onChangeText={setOtherHealthCondition}
            placeholder="Enter other health conditions (If none, leave blank)"
            placeholderTextColor={lightTheme.inputPlaceholder}
            multiline={true}
            numberOfLines={3}
          />
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity 
            style={[
              styles.button, 
              isSaving && styles.buttonDisabled
            ]}
            onPress={saveProfile}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>
              {isSaving ? 'Saving...' : (isEditingProfile ? 'Update Profile' : 'Save Profile')}
            </Text>
          </TouchableOpacity>
          
          {/* Food Analyzer Button - Only show for Update Profile (existing profiles) */}
          {isEditingProfile && (
            <TouchableOpacity 
              style={styles.subtleButton}
              onPress={() => setCurrentPage('foodAnalysis')}
            >
              <Text style={styles.subtleButtonText}>Go to Food Analyzer</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );

  // Add camera functions
  const openCamera = async (packageSide) => {
    if (!permission) {
      // Camera permissions are still loading
      return;
    }

    if (!permission.granted) {
      // Camera permissions are not granted yet
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission needed', 'Camera permission is needed to take photos');
        return;
      }
    }

    setCurrentPhotoType(packageSide); // 'front' or 'back' - refers to package side
    setCameraType('back'); // Always use back camera
    setShowCamera(true);
  };

  const takeFrontPhoto = () => openCamera('front');
  const takeBackPhoto = () => openCamera('back');

  const capturePhoto = async () => {
    if (!cameraRef) return;

    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 1,
        base64: false,
      });

      setCapturedImageUri(photo.uri);
      setShowPreview(true);
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const closeCameraModal = () => {
    setShowCamera(false);
    setShowPreview(false);
    setCapturedImageUri(null);
  };

  const confirmPhoto = () => {
    if (currentPhotoType === 'front') {
      setFrontImage(capturedImageUri);
    } else {
      setBackImage(capturedImageUri);
    }
    
    closeCameraModal();
  };

  const retryPhoto = () => {
    setShowPreview(false);
    setCapturedImageUri(null);
    // Camera stays open for another shot
  };

  // Function to convert image to base64
  const encodeImage = async (imageUri) => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result.split(',')[1];
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error encoding image:', error);
      throw error;
    }
  };

  // Function to refresh/reset the Food Analyzer page
  const refreshFoodAnalyzer = () => {
    Alert.alert(
      'Reset Food Analyzer',
      'This will clear all photos and analysis results. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setFrontImage(null);
            setBackImage(null);
            setAnalysisResult(null);
            setIsAnalyzing(false);
          },
        },
      ]
    );
  };

  // Function to analyze food using OpenAI
  const analyzeFood = async () => {
    if (!frontImage || !backImage) {
      Alert.alert('Missing Photos', 'Please click both front and back of the food packet');
      return;
    }

    if (!apiKeysConfigured || !apiKeys.openai || !apiKeys.serpapi) {
      Alert.alert('API Keys Missing', 'Please configure your API keys in Settings first.');
      return;
    }

    if (!savedProfile) {
      Alert.alert('Profile Required', 'Please save your profile first before analyzing food');
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Encode images to base64
      const frontImageBase64 = await encodeImage(frontImage);
      const backImageBase64 = await encodeImage(backImage);

      // Get saved search results for health conditions
      let webData = '';
      try {
        const searchResults = await AsyncStorage.getItem(`search_${userID}`);
        if (searchResults) {
          const parsedResults = JSON.parse(searchResults);
          webData = parsedResults.total_content || '';
        }
      } catch (error) {
        console.log('No web data found, proceeding without it');
      }

      // Run food name and ingredients analysis in parallel
      
      const [nameResponse, ingredientResponse] = await Promise.all([
        // Identify food name and type
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeys.openai}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: 'You are a food investigator. Your job is to understand the name and what food product it is'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Focus only on the food product present in the image and ignore everything else.
                           Tell what is the name of the product and what type of food product it is.
                           If the image does not contain any food product, simply answer 'no food product present' 
                           return 
                           1. The name of the product
                           2. The type of food product. 
                           3. Health claim that the product makes, if any.
                           Don't give any description or any other information about the image.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${frontImageBase64}`
                    }
                  }
                ]
              }
            ],
            temperature: 0.0,
            max_tokens: 500
          })
        }),
        
                  // Extract ingredients from back image
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKeys.openai}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1',
            messages: [
              {
                role: 'system',
                content: 'You are a food investigator. Your job is to understand ingredient present in a food product'
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Focus only on the food product present in the image and ignore everything else.
                           See all the ingredients and other nutrients present in this food product and list them down. Carefully examine all the sections and extract any part which contains anything related to ingredients or nutrients.
                           If the image does not contain any food product, simply answer 'no food product present' 
                           return just the ingredient and other nutrients present in the food product. Don't give any description or any other information about the image.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/jpeg;base64,${backImageBase64}`
                    }
                  }
                ]
              }
            ],
            temperature: 0.0,
            max_tokens: 1000
          })
        })
      ]);


      
      // Handle name response
      if (!nameResponse.ok) {
        const errorText = await nameResponse.text();
        console.error('Name API Error Response:', errorText);
        throw new Error(`Name API Error (${nameResponse.status}): ${errorText.substring(0, 200)}...`);
      }

      // Handle ingredients response
      if (!ingredientResponse.ok) {
        const errorText = await ingredientResponse.text();
        console.error('Ingredients API Error Response:', errorText);
        throw new Error(`Ingredients API Error (${ingredientResponse.status}): ${errorText.substring(0, 200)}...`);
      }

      // Parse both responses in parallel
      const [nameData, ingredientData] = await Promise.all([
        nameResponse.json(),
        ingredientResponse.json()
      ]);

      const foodName = nameData.choices[0].message.content;
      const foodIngredients = ingredientData.choices[0].message.content;

      // Analyze health impact
      const healthResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeys.openai}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are a dietitian. Your job is to understand ingredient present in a food product and tell a patient good for health.
                       Also if the patient has any pre-existing disease, health condition or food allergy, correlate the ingredient/nutrients present in the product with the disease/allergy and give medical advice of benefits and/or drawback of having the food product.`
            },
            {
              role: 'user',
              content: `The ingredients present in the food are ${foodIngredients}.
                       The profile of the patient is age = ${savedProfile.age}, gender = ${savedProfile.gender}, height = ${savedProfile.height}, weight = ${savedProfile.weight}, food allergy = ${savedProfile.foodAllergy}.
                       The pre-existing disease are ${savedProfile.existingDisease} and other health conditions are ${savedProfile.otherHealthCondition}.
                       Some food related dos and don'ts for the disease and health conditions are stored in ${webData}. You can refer this as guidelines. Also, give citation of which answer is picked from which page and give reference to this while giving your answer.
                       Clearly tell the patient 2 different sections:
                       1. If there is any difference between the claim that the product makes in the front image, present in ${foodName} and the ingredients present in the back image, clearly tell the patient about it.
                       2. What is the good about having this food?
                       3. What is the bad about having this food?
                       
                       Keep it short, concise and professional. 
                       Don't give any summary table.
                       Don't  give the output in markdown format.
                       Give all the references at the end of the answer. Always provide the actualy website link with https://
                       Always give a caution message at the end of the answer to consult a doctor or dietitian for any heath complications or serious health issues.
                       The output will be shown in a mobile app. So keep create the format acoordingly.`
            }
          ],
          temperature: 0.0,
          max_tokens: 1500
        })
      });

      const healthData = await healthResponse.json();
      if (!healthResponse.ok) {
        throw new Error(healthData.error?.message || 'Failed to analyze health impact');
      }
      const healthAnalysis = healthData.choices[0].message.content;

      // Set analysis result
      setAnalysisResult({
        foodName,
        foodIngredients,
        healthAnalysis
      });

    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Analysis Failed', error.message || 'Failed to analyze food. Please check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Update the renderFoodAnalysisPage function
  const renderFoodAnalysisPage = () => (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentPage('home')}
        >
          <Text style={styles.backButtonText}>🏠 Home</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Food Analyzer</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={refreshFoodAnalyzer}
        >
          <Text style={styles.refreshButtonText}>🔄 Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <KeyboardAwareScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraHeight={100}
        extraScrollHeight={100}
        keyboardOpeningTime={0}
      >
        {/* User ID Display */}
        <View style={styles.userIdContainer}>
          <Text style={styles.userIdLabel}>Current User:</Text>
          <Text style={styles.userIdValue}>{userID}</Text>
        </View>

        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>Product Photos</Text>
          
          <View style={styles.photoRow}>
            {/* Front Photo */}
            <View style={styles.photoContainerHalf}>
              <Text style={styles.photoLabel}>Front of Package</Text>
              {frontImage ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: frontImage }} style={styles.previewImageHalf} />
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.retakeButton} onPress={takeFrontPhoto}>
                      <Text style={styles.retakeButtonText}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.clearButton} onPress={() => setFrontImage(null)}>
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoButtonHalf} onPress={takeFrontPhoto}>
                  <Text style={styles.photoButtonText}>📷 Front</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Back Photo */}
            <View style={styles.photoContainerHalf}>
              <Text style={styles.photoLabel}>Back (Ingredients)</Text>
              {backImage ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: backImage }} style={styles.previewImageHalf} />
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.retakeButton} onPress={takeBackPhoto}>
                      <Text style={styles.retakeButtonText}>Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.clearButton} onPress={() => setBackImage(null)}>
                      <Text style={styles.clearButtonText}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoButtonHalf} onPress={takeBackPhoto}>
                  <Text style={styles.photoButtonText}>📷 Back</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[
              styles.button,
              ((!frontImage || !backImage) || isAnalyzing) && styles.buttonDisabled
            ]}
            onPress={analyzeFood}
            disabled={(!frontImage || !backImage) || isAnalyzing}
          >
            <Text style={styles.buttonText}>
              {isAnalyzing ? 'Analyzing...' : 'Analyze Food'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.subtleButton}
            onPress={() => {
              setIsEditingProfile(true);
              // Ensure all profile data is maintained
              if (savedProfile) {
                // Handle date of birth - if missing from old profiles, user can set it
                if (savedProfile.dateOfBirth) {
                  setDateOfBirth(new Date(savedProfile.dateOfBirth));
                }
                // Note: if dateOfBirth is missing, current dateOfBirth state remains (today's date)
                // User can update it as needed
                
                setAge(savedProfile.age);
                if (savedProfile.ageDetails) {
                  setAgeDetails(savedProfile.ageDetails);
                }
                setGender(savedProfile.gender);
                setWeight(savedProfile.weight);
                setWeightUnit(savedProfile.weightUnit);
                setHeight(savedProfile.height);
                setHeightUnit(savedProfile.heightUnit);
                setFoodAllergy(savedProfile.foodAllergy || '');
                setExistingDisease(savedProfile.existingDisease || '');
                setOtherHealthCondition(savedProfile.otherHealthCondition || '');
              }
              setCurrentPage('profile');
            }}
          >
            <Text style={styles.subtleButtonText}>Update Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Analysis Results */}
        {analysisResult && (
          <View style={styles.analysisContainer}>
            <Text style={styles.analysisTitle}>🔬 Analysis Results</Text>
            
            {/* Food Product Section */}
            <View style={styles.analysisSection}>
              <Text style={styles.redSectionTitle}>📦 Food Product</Text>
              <View style={styles.sectionContent}>
                {parseAnalysisText(analysisResult.foodName).map((section, index) => (
                  <View key={index}>
                    {section.title !== 'Analysis' && (
                      <Text style={styles.subSectionTitle}>{section.title}</Text>
                    )}
                    {renderBulletPoints(section.content)}
                  </View>
                ))}
              </View>
            </View>
            
            {/* Ingredients Section */}
            <View style={styles.analysisSection}>
              <Text style={styles.redSectionTitle}>🧪 Ingredients & Nutrients</Text>
              <View style={styles.sectionContent}>
                {parseAnalysisText(analysisResult.foodIngredients).map((section, index) => (
                  <View key={index}>
                    {section.title !== 'Analysis' && (
                      <Text style={styles.subSectionTitle}>{section.title}</Text>
                    )}
                    {renderBulletPoints(section.content)}
                  </View>
                ))}
              </View>
            </View>
            
            {/* Health Analysis Section */}
            <View style={styles.analysisSection}>
              <Text style={styles.redSectionTitle}>⚕️ Health Analysis</Text>
              <View style={styles.sectionContent}>
                {parseAnalysisText(analysisResult.healthAnalysis).map((section, index) => (
                  <View key={index} style={styles.healthSubSection}>
                    {section.title !== 'Analysis' && (
                      <Text style={styles.subSectionTitle}>{section.title}</Text>
                    )}
                    {renderBulletPoints(section.content)}
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Instructions:</Text>
          <Text style={styles.instructionsText}>2. Take a clear photo of the front of the food package</Text>
          <Text style={styles.instructionsText}>3. Take a clear photo of the back showing ingredients list</Text>
          <Text style={styles.instructionsText}>4. Click "Analyze Food" to check for harmful ingredients</Text>
          <Text style={styles.instructionsText}>5. Review the analysis results</Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );

  // Main Render
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {currentPage === 'home' && renderHomePage()}
      {currentPage === 'profile' && renderProfilePage()}
      {currentPage === 'loadProfile' && renderLoadProfilePage()}
      {currentPage === 'deleteProfile' && renderDeleteProfilePage()}
      {currentPage === 'foodAnalysis' && renderFoodAnalysisPage()}
      
      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
      >
                 <View style={styles.cameraContainer}>
           {permission && permission.granted ? (
             <>
               {showPreview ? (
                 // Preview Screen
                 <>
                   <Image 
                     source={{ uri: capturedImageUri }} 
                     style={styles.previewImage} 
                   />
                   <View style={styles.previewOverlay}>
                     <View style={styles.previewHeader}>
                       <TouchableOpacity 
                         style={styles.cameraCloseButton}
                         onPress={closeCameraModal}
                       >
                         <Text style={styles.cameraCloseButtonText}>✕</Text>
                       </TouchableOpacity>
                       <Text style={styles.cameraTitle}>
                         {currentPhotoType === 'front' ? 'Front of Package' : 'Back of Package'}
                       </Text>
                       <View style={styles.cameraHeaderSpacer} />
                     </View>
                     
                     <View style={styles.previewFooter}>
                       <TouchableOpacity 
                         style={styles.retryButton}
                         onPress={retryPhoto}
                       >
                         <Text style={styles.retryButtonText}>Retry</Text>
                       </TouchableOpacity>
                       
                       <TouchableOpacity 
                         style={styles.okButton}
                         onPress={confirmPhoto}
                       >
                         <Text style={styles.okButtonText}>Ok</Text>
                       </TouchableOpacity>
                     </View>
                   </View>
                 </>
               ) : (
                 // Camera Screen
                 <>
                   <CameraView
                     style={styles.camera}
                     facing={cameraType === 'front' ? 'front' : 'back'}
                     ref={setCameraRef}
                   />
                   <View style={styles.cameraOverlay}>
                     <View style={styles.cameraHeader}>
                       <TouchableOpacity 
                         style={styles.cameraCloseButton}
                         onPress={closeCameraModal}
                       >
                         <Text style={styles.cameraCloseButtonText}>✕</Text>
                       </TouchableOpacity>
                       <Text style={styles.cameraTitle}>
                         {currentPhotoType === 'front' ? 'Front of Package' : 'Back of Package'}
                       </Text>
                       <View style={styles.cameraHeaderSpacer} />
                     </View>
                     
                     <View style={styles.cameraFooter}>
                       <TouchableOpacity 
                         style={styles.captureButton}
                         onPress={capturePhoto}
                       >
                         <View style={styles.captureButtonInner} />
                       </TouchableOpacity>
                     </View>
                   </View>
                 </>
               )}
             </>
           ) : (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionText}>Camera permission required</Text>
              <TouchableOpacity 
                style={styles.permissionButton}
                onPress={requestPermission}
              >
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
      
      {/* Settings Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={showSettings}
        onRequestClose={() => {
          if (apiKeysConfigured) {
            setShowSettings(false);
          } else {
            Alert.alert('API Keys Required', 'Please configure your API keys before continuing.');
          }
        }}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.fixedHeader}>
            {apiKeysConfigured && (
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setShowSettings(false)}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.pageTitle}>Settings</Text>
          </View>

          <KeyboardAwareScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            enableAutomaticScroll={true}
            extraHeight={150}
            extraScrollHeight={150}
            keyboardOpeningTime={0}
          >
            <SettingsForm />
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );

  function SettingsForm() {
    const [openaiKey, setOpenaiKey] = useState(apiKeys.openai || '');
    const [serpapiKey, setSerpapiKey] = useState(apiKeys.serpapi || '');

    const handleSave = async () => {
      if (!openaiKey.trim() || !serpapiKey.trim()) {
        Alert.alert('Error', 'Both API keys are required');
        return;
      }
      await saveApiKeys(openaiKey.trim(), serpapiKey.trim());
    };

    const handleTest = async () => {
      if (!openaiKey.trim() || !serpapiKey.trim()) {
        Alert.alert('Error', 'Both API keys are required to test');
        return;
      }
      await testApiKeys(openaiKey.trim(), serpapiKey.trim());
    };

    return (
      <View style={styles.settingsContainer}>
        <Text style={styles.settingsTitle}>API Configuration</Text>
        <Text style={styles.settingsDescription}>
          {isFirstLaunch 
            ? 'Welcome! Please configure your API keys to get started.' 
            : 'Configure your API keys to use the Food Analyzer functionality.'}
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>OpenAI API Key</Text>
          <Text style={styles.sublabel}>Get your key from: https://platform.openai.com/api-keys</Text>
          <TextInput
            style={[styles.input, styles.apiKeyInput]}
            value={openaiKey}
            onChangeText={setOpenaiKey}
            placeholder="sk-proj-..."
            placeholderTextColor={lightTheme.inputPlaceholder}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>SerpAPI Key</Text>
          <Text style={styles.sublabel}>Get your key from: https://serpapi.com/manage-api-key</Text>
          <TextInput
            style={[styles.input, styles.apiKeyInput]}
            value={serpapiKey}
            onChangeText={setSerpapiKey}
            placeholder="Enter your SerpAPI key"
            placeholderTextColor={lightTheme.inputPlaceholder}
            secureTextEntry={true}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.settingsButtonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.testButton, isTestingKeys && styles.buttonDisabled]}
            onPress={handleTest}
            disabled={isTestingKeys}
          >
            <Text style={styles.buttonText}>
              {isTestingKeys ? 'Testing...' : 'Test Keys'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>Save Keys</Text>
          </TouchableOpacity>
        </View>

        {!apiKeysConfigured && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningText}>
              ⚠️ API keys are required to use the Food Analyzer functionality. 
              Please configure both keys to continue.
            </Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Why do I need these keys?</Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>OpenAI API:</Text> Analyzes food package images and provides health recommendations
          </Text>
          <Text style={styles.infoText}>
            • <Text style={styles.bold}>SerpAPI:</Text> Searches for health information about your medical conditions
          </Text>
          <Text style={styles.infoText}>
            Both keys are stored locally on your device and never shared.
          </Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightTheme.background,
    paddingTop: Platform.OS === 'ios' ? 0 : 0, // Remove top padding to fix status bar visibility
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Add bottom padding for home indicator/buttons
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24, // Add bottom padding for home indicator/buttons
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: lightTheme.background,
    borderBottomWidth: 1,
    borderBottomColor: lightTheme.border,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: lightTheme.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: lightTheme.text,
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: lightTheme.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    paddingHorizontal: 20,
  },
  homeButton: {
    backgroundColor: lightTheme.primary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  homeButtonText: {
    color: lightTheme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: lightTheme.text,
    marginTop: 20,
    marginBottom: 5,
  },
  sublabel: {
    fontSize: 12,
    color: lightTheme.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: lightTheme.inputBackground,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: lightTheme.border,
    fontSize: 16,
    color: lightTheme.inputText,
  },
  inputDisabled: {
    backgroundColor: lightTheme.disabledButton,
    color: lightTheme.disabledText,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    backgroundColor: lightTheme.inputBackground,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: lightTheme.border,
  },
  dateButtonText: {
    fontSize: 16,
    color: lightTheme.inputText,
  },
  ageDisplay: {
    backgroundColor: lightTheme.primary + '20',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  ageText: {
    fontSize: 18,
    fontWeight: '600',
    color: lightTheme.primary,
  },
  ageDetailsText: {
    fontSize: 14,
    color: lightTheme.primary,
    marginTop: 5,
  },
  genderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: lightTheme.border,
    alignItems: 'center',
    backgroundColor: lightTheme.inputBackground,
  },
  genderButtonSelected: {
    backgroundColor: lightTheme.selectedButton,
    borderColor: lightTheme.selectedButton,
  },
  genderButtonText: {
    fontSize: 16,
    color: lightTheme.text,
  },
  genderButtonTextSelected: {
    color: lightTheme.buttonText,
    fontWeight: '600',
  },
  measurementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measurementInput: {
    flex: 1,
    marginRight: 10,
  },
  unitContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  unitButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: lightTheme.border,
    backgroundColor: lightTheme.inputBackground,
  },
  unitButtonSelected: {
    backgroundColor: lightTheme.selectedButton,
    borderColor: lightTheme.selectedButton,
  },
  unitButtonText: {
    fontSize: 16,
    color: lightTheme.text,
  },
  unitButtonTextSelected: {
    color: lightTheme.buttonText,
    fontWeight: '600',
  },
  button: {
    backgroundColor: lightTheme.saveButton,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: lightTheme.buttonText,
    fontSize: 18,
    fontWeight: '600',
  },
  profileList: {
    flex: 1,
    marginBottom: 15,
  },
  profileItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: lightTheme.border,
    backgroundColor: lightTheme.cardBackground,
  },
  profileItemText: {
    fontSize: 16,
    color: lightTheme.text,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  weightInput: {
    flex: 2,
    marginRight: 10,
  },
  heightInput: {
    flex: 2,
    marginRight: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  selectedGender: {
    backgroundColor: lightTheme.primary,
  },
  homeContainer: {
    flex: 1,
    backgroundColor: lightTheme.background,
  },
  homeContent: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 50, // Add proper top padding for status bar
  },
  headerSection: {
    marginTop: 20,
    marginBottom: 30,
  },
  sectionsContainer: {
    gap: 20,
  },
  sectionCard: {
    backgroundColor: lightTheme.cardBackground,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lightTheme.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: lightTheme.text,
  },
  sectionDescription: {
    fontSize: 14,
    color: lightTheme.textSecondary,
    marginBottom: 15,
    lineHeight: 20,
  },
  sectionFooter: {
    borderTopWidth: 1,
    borderTopColor: lightTheme.border,
    paddingTop: 15,
  },
  sectionAction: {
    fontSize: 16,
    color: lightTheme.primary,
    fontWeight: '600',
  },
  formContainer: {
    backgroundColor: lightTheme.cardBackground,
    borderRadius: 15,
    padding: 20,
    margin: 20,
    marginBottom: Platform.OS === 'ios' ? 34 : 24, // Add bottom margin for home indicator/buttons
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  inputContainer: {
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: lightTheme.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  profilesList: {
    padding: 20,
  },
  profileItem: {
    backgroundColor: lightTheme.cardBackground,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  profileInfo: {
    flex: 1,
    marginRight: 15,
  },
  profileUserID: {
    fontSize: 16,
    fontWeight: '600',
    color: lightTheme.text,
    marginBottom: 5,
  },
  profileDetails: {
    fontSize: 14,
    color: lightTheme.textSecondary,
    marginBottom: 3,
  },
  profileDate: {
    fontSize: 12,
    color: lightTheme.textSecondary,
  },
  deleteButton: {
    backgroundColor: lightTheme.error,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  deleteButtonText: {
    color: lightTheme.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: lightTheme.textSecondary,
    marginTop: 20,
  },
  noProfilesText: {
    textAlign: 'center',
    fontSize: 16,
    color: lightTheme.textSecondary,
    marginTop: 20,
  },
  form: {
    backgroundColor: lightTheme.cardBackground,
    borderRadius: 15,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Load Profile Page Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: lightTheme.textSecondary,
    textAlign: 'center',
  },

  // Delete Profile Page Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: lightTheme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: lightTheme.textSecondary,
    textAlign: 'center',
  },
  profilesList: {
    padding: 20,
  },
  profileItem: {
    backgroundColor: lightTheme.cardBackground,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  profileInfo: {
    flex: 1,
    marginRight: 15,
  },
  profileUserID: {
    fontSize: 16,
    fontWeight: '600',
    color: lightTheme.text,
    marginBottom: 5,
  },
  profileDetails: {
    fontSize: 14,
    color: lightTheme.textSecondary,
    marginBottom: 3,
  },
  profileDate: {
    fontSize: 12,
    color: lightTheme.textSecondary,
  },
  deleteButton: {
    backgroundColor: lightTheme.error,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  deleteButtonText: {
    color: lightTheme.buttonText,
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  userIdText: {
    fontSize: 16,
    color: '#6c757d',
  },
  buttonContainer: {
    padding: 20,
    gap: 15,
  },
  editButton: {
    backgroundColor: '#6c757d',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  analyzeButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  instructionsContainer: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    margin: 20,
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#212529',
  },
  instructionsText: {
    fontSize: 16,
    color: '#495057',
    marginBottom: 8,
  },
  photoSection: {
    padding: 20,
  },
  photoContainer: {
    marginBottom: 25,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#495057',
  },
  photoButton: {
    backgroundColor: '#dc3545',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#c82333',
    borderStyle: 'dashed',
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  photoContainerHalf: {
    flex: 1,
  },
  photoButtonHalf: {
    backgroundColor: '#dc3545',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#c82333',
    borderStyle: 'dashed',
    minHeight: 120,
    justifyContent: 'center',
  },
  previewImageHalf: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  photoButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  imageActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  retakeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retakeButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  fixedHeader: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 5,
    paddingTop: Platform.OS === 'ios' ? 60 : 50, // Add top padding for status bar
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: lightTheme.text,
    textAlign: 'center',
    flex: 1,
  },
  userIdHeaderText: {
    fontSize: 18,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 5,
  },
  scrollContent: {
    flex: 1,
  },
  whiteBackground: {
    backgroundColor: '#ffffff',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonContainer: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 0,
  },
  subtleButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6c757d',
    marginTop: 10,
  },
  subtleButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
  },
  userIdContainer: {
    backgroundColor: lightTheme.cardBackground,
    padding: 15,
    marginBottom: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userIdLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: lightTheme.textSecondary,
  },
  userIdValue: {
    fontSize: 16,
    color: lightTheme.text,
    fontWeight: '500',
  },
  analysisContainer: {
    backgroundColor: lightTheme.cardBackground,
    padding: 20,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: lightTheme.text,
    marginBottom: 15,
    textAlign: 'center',
  },
  analysisSection: {
    marginBottom: 15,
  },
  analysisSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: lightTheme.primary,
    marginBottom: 8,
  },
  analysisText: {
    fontSize: 14,
    color: lightTheme.text,
    lineHeight: 20,
  },
  redSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionContent: {
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 5,
  },
  healthSubSection: {
    marginBottom: 15,
  },
  bulletPointContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  bulletPoint: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 2,
  },
  bulletContent: {
    flex: 1,
  },
  bulletText: {
    fontSize: 14,
    color: '#212529',
    lineHeight: 20,
  },
  linkText: {
    color: '#007bff',
    textDecorationLine: 'underline',
  },
  refreshButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  refreshButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  cameraCloseButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCloseButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraHeaderSpacer: {
    width: 40,
  },
  cameraFooter: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
  },
  permissionText: {
    fontSize: 18,
    color: lightTheme.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: lightTheme.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Preview styles
  previewImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingBottom: Platform.OS === 'ios' ? 50 : 30,
  },
  retryButton: {
    backgroundColor: 'rgba(220, 53, 69, 0.9)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  okButton: {
    backgroundColor: 'rgba(40, 167, 69, 0.9)',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  okButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Special style for Food Analyzer card
  foodAnalyzerCard: {
    borderWidth: 2,
    borderColor: lightTheme.primary,
    backgroundColor: lightTheme.primary + '10', // Light blue background
  },
  // Settings styles
  headerWithSettings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerText: {
    flex: 1,
  },
  settingsIcon: {
    padding: 10,
    marginLeft: 10,
  },
  settingsIconText: {
    fontSize: 24,
  },
  settingsContainer: {
    paddingVertical: 20,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: lightTheme.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  settingsDescription: {
    fontSize: 16,
    color: lightTheme.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  apiKeyInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
  },
  settingsButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  testButton: {
    backgroundColor: '#6c757d',
    flex: 0.48,
  },
  saveButton: {
    backgroundColor: lightTheme.primary,
    flex: 0.48,
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    marginTop: 20,
  },
  warningText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 20,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: lightTheme.text,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: lightTheme.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '600',
    color: lightTheme.text,
  },
}); 