# Food Ingredients Analyzer

A React Native mobile application that analyzes food package ingredients using AI to provide personalized health recommendations based on your medical conditions and food allergies.

## 🎯 What It Does

The Food Ingredients Analyzer uses artificial intelligence to:
- **Analyze Food Packages**: Take photos of food packages and get instant ingredient analysis
- **Personalized Health Advice**: Receive recommendations based on your specific health conditions
- **Food Safety Warnings**: Get alerts about ingredients that may be harmful to your health
- **Privacy-First Design**: All your health data stays on your device

## 🚀 Quick Start

### Option 1: Download APK (Recommended)
1. **Download from GitHub Releases**:
   - Go to [Releases](https://github.com/kushalmukherjee20/food-ingredients-analyzer/releases/tag/v1.0.0) page
   - Download the latest `food-analyzer-latest.apk`
   - Or download directly: [Latest APK](https://github.com/kushalmukherjee20/food-ingredients-analyzer/releases/download/v1.0.0/food-analyzer-latest.apk)


2. **Install and Setup**:
   - Install APK on your Android device
   - Open the app and configure your API keys
   - Create your health profile
   - Start analyzing food packages!

### Option 2: Run from Source
```bash
# Clone the repository
git clone https://github.com/kushalmukherjee20/food-ingredients-analyzer.git
cd food-ingredients-analyzer/mobile_app

# Install dependencies
npm install

# Start the development server
npm start
# or
./start.bat  # Windows
./start.sh   # Linux/Mac
```

## 📋 Prerequisites

### Required API Keys
You'll need to obtain these API keys (free tiers available):

1. **OpenAI API Key**
   - Visit: https://platform.openai.com/api-keys
   - Create account and generate API key
   - Estimated cost: $0.01-0.04 per food analysis

2. **SerpAPI Key**
   - Visit: https://serpapi.com/manage-api-key
   - Free tier: 100 searches/month
   - Used for health research (3-6 searches per profile)

## 📱 Complete User Journey

### 🔧 First Launch - API Configuration
1. **App Opens** → Automatically redirects to Settings
2. **Settings Page** appears with:
   - OpenAI API Key input field
   - SerpAPI Key input field
   - Links to get API keys
   - Test Keys button
   - Save Keys button

3. **Configure API Keys**:
   ```
   OpenAI API Key: sk-proj-xxxxxxxxxxxxx
   SerpAPI Key: your-serpapi-key-here
   ```

4. **Test Keys** → Validates both API keys work
5. **Save Keys** → Stores securely on your device

### 👤 Create Health Profile
1. **Navigate to "Create New Profile"**
2. **Enter Personal Information**:
   - User ID (your email address)
   - Date of birth (auto-calculates age)
   - Gender (Male/Female)
   - Weight with units (KG/Pounds)
   - Height with units (cm/inches)

3. **Add Health Conditions** (optional):
   - Food allergies (comma-separated): `peanuts, shellfish, dairy`
   - Existing diseases: `diabetes, hypertension`
   - Other health conditions: `lactose intolerance`

4. **Save Profile** → App researches your health conditions online. This is a one time activity unless you edit your profile.

### 🔍 Analyze Food Packages
1. **Navigate to "Food Analyzer"**
2. **Load Your Profile** (if not already loaded)
3. **Take Photos**:
   - **Front Photo**: Clear shot of product name and branding
   - **Back Photo**: Clear shot of ingredients list
   - Use **Retry** button if photo isn't clear
   - Tap **OK** to confirm each photo

4. **Analyze Food** → AI processes both images
5. **Review Results**:
   - Product identification
   - Ingredient analysis
   - Health impact assessment
   - Personalized recommendations
   - Warnings for your specific conditions

### 📊 Example Analysis Result
```
Product: Chocolate Chip Cookies
Type: Packaged snack food

Health Analysis:
✅ Good: Contains whole grain flour
⚠️  Caution: High sugar content (not suitable for diabetes)
❌ Avoid: Contains milk (lactose intolerance concern)

Recommendations:
- Consider sugar-free alternatives
- Check for lactose-free versions
- Limit portion size due to high calorie content
```

## 🔒 Privacy & Security

- **No Data Collection**: Your health data never leaves your device
- **Local Storage**: All profiles stored using device storage only
- **API Keys Security**: Keys stored locally, never transmitted
- **Fresh Install**: App clears all data on new installations
- **No Tracking**: Zero analytics, no user tracking

## 🛠 Technical Features

- **React Native**: Cross-platform mobile framework
- **Expo Camera**: Professional camera integration
- **AsyncStorage**: Secure local data persistence
- **OpenAI GPT-4.1**: Advanced image and text analysis
- **SerpAPI**: Health information research
- **Offline Profiles**: Profile management works offline

## 📖 Detailed Feature Guide

### Settings Management
- **Access**: Tap ⚙️ icon on home page anytime
- **Update Keys**: Change API keys when needed
- **Test Function**: Verify API keys work before saving
- **Security**: All keys encrypted and stored locally

### Profile Management
- **Multiple Profiles**: Create profiles for family members
- **Easy Loading**: Switch between profiles quickly
- **Data Validation**: App prevents duplicate User IDs
- **Edit Anytime**: Update health information as needed
- **Safe Deletion**: Remove profiles you no longer need


### Analysis Capabilities
- **Dual Image Analysis**: Processes front and back package photos
- **Ingredient Detection**: Identifies all ingredients and additives
- **Health Impact**: Analyzes effects on your specific conditions
- **Web Research**: Automatically researches your health conditions
- **Personalized Warnings**: Alerts about problematic ingredients

## 🚫 Troubleshooting

### Common Issues

**"API Keys Missing" Error**
- Go to Settings (⚙️ icon)
- Enter both OpenAI and SerpAPI keys
- Test keys to verify they work

**Camera Not Working**
- Check camera permissions in device settings
- Grant camera access to the app
- Restart app if needed

**Analysis Fails**
- Verify API keys have sufficient credits
- Check internet connection
- Ensure photos clearly show ingredients

**Profile Won't Load**
- Check User ID (email) is correct
- Verify profile was saved successfully
- Try creating new profile if corrupted

### Getting Help
1. Check API key credits and validity
2. Ensure stable internet connection
3. Take clear, well-lit photos of ingredients
4. Verify all required fields in profile are filled

## 🏗 Building from Source

### Development Setup
```bash
# Prerequisites: Node.js 16+, npm/yarn, Expo CLI
npm install -g expo-cli

# Clone and setup
git clone https://github.com/kushalmukherjee20/food-ingredients-analyzer.git
cd food-ingredients-analyzer/mobile_app
npm install

# Run development
npm start
```

### Building APK
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build for Android
eas build --platform android --profile preview

# Build for production
eas build --platform android --profile production
```

## 💰 Cost Estimation

### Per Food Analysis
- **OpenAI GPT-4.1**: ~$0.01-0.03
- **Total Cost**: ~$0.01-0.04 per analysis

### SerpAPI Usage
- **Profile Creation**: 3-6 searches (one-time per profile)
- **Free Tier**: 100 searches/month
- **Paid Plans**: Start at $50/month for 5,000 searches

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## ⚠️ Disclaimer

This app is for informational purposes only and should not replace professional medical advice. Always consult healthcare professionals for medical decisions.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

If you encounter issues:
1. Check your API key credits and validity
2. Ensure stable internet connection
3. Verify photos are clear and show ingredients clearly
4. Review troubleshooting section above

---

**Made with ❤️ for health-conscious food choices** 