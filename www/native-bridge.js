// ============================================
// FILE: www/native-bridge.js
// Native Bridge - Connects Web App to Native Features
// VERSION: 1.1.0
// ============================================

(function() {
  'use strict';

  // Check if running in Capacitor
  const isCapacitor = window.Capacitor !== undefined;
  
  if (!isCapacitor) {
    console.log('📱 Not running in Capacitor, native bridge disabled');
    return;
  }

  console.log('📱 CYBEV Native Bridge v1.1.0 initializing...');

  // Import Capacitor plugins
  const { Capacitor, Plugins } = window.Capacitor;
  const {
    PushNotifications,
    LocalNotifications,
    App,
    Browser,
    Camera,
    Device,
    Filesystem,
    Haptics,
    Keyboard,
    Network,
    Preferences,
    Share,
    SplashScreen,
    StatusBar,
    Toast
  } = Plugins;

  // ==========================================
  // DEVICE INFO
  // ==========================================
  
  async function getDeviceInfo() {
    try {
      const info = await Device.getInfo();
      const id = await Device.getId();
      return { ...info, deviceId: id.identifier };
    } catch (error) {
      console.error('Device info error:', error);
      return null;
    }
  }

  // ==========================================
  // PUSH NOTIFICATIONS
  // ==========================================

  async function initializePushNotifications() {
    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission not granted');
        return null;
      }

      // Register with Apple/Google
      await PushNotifications.register();

      // Listen for registration
      PushNotifications.addListener('registration', (token) => {
        console.log('📱 Push token:', token.value);
        
        // Send token to backend
        sendPushTokenToServer(token.value);
        
        // Store locally
        Preferences.set({ key: 'pushToken', value: token.value });
        
        // Dispatch event for web app
        window.dispatchEvent(new CustomEvent('cybev:pushToken', { 
          detail: { token: token.value } 
        }));
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      // Listen for push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('📱 Push received:', notification);
        
        // Show local notification if app is in foreground
        showLocalNotification(notification.title, notification.body, notification.data);
        
        // Dispatch event for web app
        window.dispatchEvent(new CustomEvent('cybev:pushReceived', { 
          detail: notification 
        }));
      });

      // Listen for notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('📱 Push action:', action);
        
        // Handle deep linking from notification
        handleNotificationAction(action.notification.data);
        
        window.dispatchEvent(new CustomEvent('cybev:pushAction', { 
          detail: action 
        }));
      });

      console.log('✅ Push notifications initialized');
      return true;
    } catch (error) {
      console.error('Push init error:', error);
      return false;
    }
  }

  async function sendPushTokenToServer(token) {
    try {
      const authToken = localStorage.getItem('token') || localStorage.getItem('cybev_token');
      if (!authToken) return;

      const deviceInfo = await getDeviceInfo();

      await fetch('https://api.cybev.io/api/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          token,
          platform: deviceInfo?.platform || 'unknown',
          deviceId: deviceInfo?.deviceId,
          model: deviceInfo?.model
        })
      });
    } catch (error) {
      console.error('Failed to send push token:', error);
    }
  }

  // ==========================================
  // LOCAL NOTIFICATIONS
  // ==========================================

  async function showLocalNotification(title, body, data = {}) {
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title,
          body,
          sound: 'beep.wav',
          smallIcon: 'ic_notification',
          iconColor: '#7c3aed',
          extra: data
        }]
      });
    } catch (error) {
      console.error('Local notification error:', error);
    }
  }

  // ==========================================
  // DEEP LINKING
  // ==========================================

  function initializeDeepLinking() {
    // Handle app URL open
    App.addListener('appUrlOpen', (data) => {
      console.log('📱 Deep link:', data.url);
      
      const url = new URL(data.url);
      const path = url.pathname;
      
      // Navigate to the appropriate page
      if (path.startsWith('/blog/')) {
        window.location.href = data.url;
      } else if (path.startsWith('/profile/')) {
        window.location.href = data.url;
      } else if (path.startsWith('/live/')) {
        window.location.href = data.url;
      } else if (path.startsWith('/post/')) {
        window.location.href = data.url;
      } else {
        window.location.href = data.url;
      }

      window.dispatchEvent(new CustomEvent('cybev:deepLink', { 
        detail: { url: data.url, path } 
      }));
    });

    // Handle app state changes
    App.addListener('appStateChange', (state) => {
      console.log('📱 App state:', state.isActive ? 'active' : 'background');
      
      window.dispatchEvent(new CustomEvent('cybev:appState', { 
        detail: { isActive: state.isActive } 
      }));
    });

    // Handle back button (Android)
    App.addListener('backButton', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    console.log('✅ Deep linking initialized');
  }

  function handleNotificationAction(data) {
    if (!data) return;

    // Navigate based on notification type
    if (data.type === 'message') {
      window.location.href = `/messages/${data.conversationId || ''}`;
    } else if (data.type === 'follow') {
      window.location.href = `/profile/${data.userId || ''}`;
    } else if (data.type === 'like' || data.type === 'comment') {
      if (data.blogId) {
        window.location.href = `/blog/${data.blogId}`;
      } else if (data.postId) {
        window.location.href = `/post/${data.postId}`;
      }
    } else if (data.type === 'live') {
      window.location.href = `/live/${data.streamId || ''}`;
    } else if (data.url) {
      window.location.href = data.url;
    }
  }

  // ==========================================
  // CAMERA & MEDIA
  // ==========================================

  async function takePhoto(options = {}) {
    try {
      const image = await Camera.getPhoto({
        quality: options.quality || 90,
        allowEditing: options.allowEditing !== false,
        resultType: 'base64',
        source: 'CAMERA',
        width: options.width || 1080,
        height: options.height || 1080
      });

      return {
        base64: image.base64String,
        format: image.format,
        dataUrl: `data:image/${image.format};base64,${image.base64String}`
      };
    } catch (error) {
      console.error('Camera error:', error);
      return null;
    }
  }

  async function pickFromGallery(options = {}) {
    try {
      const image = await Camera.getPhoto({
        quality: options.quality || 90,
        allowEditing: options.allowEditing !== false,
        resultType: 'base64',
        source: 'PHOTOS',
        width: options.width || 1080,
        height: options.height || 1080
      });

      return {
        base64: image.base64String,
        format: image.format,
        dataUrl: `data:image/${image.format};base64,${image.base64String}`
      };
    } catch (error) {
      console.error('Gallery error:', error);
      return null;
    }
  }

  // ==========================================
  // NATIVE SHARE
  // ==========================================

  async function nativeShare(options) {
    try {
      const result = await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle || 'Share via'
      });
      return result;
    } catch (error) {
      console.error('Share error:', error);
      return null;
    }
  }

  // ==========================================
  // HAPTIC FEEDBACK
  // ==========================================

  function hapticLight() {
    Haptics?.impact({ style: 'LIGHT' });
  }

  function hapticMedium() {
    Haptics?.impact({ style: 'MEDIUM' });
  }

  function hapticHeavy() {
    Haptics?.impact({ style: 'HEAVY' });
  }

  function hapticSuccess() {
    Haptics?.notification({ type: 'SUCCESS' });
  }

  function hapticError() {
    Haptics?.notification({ type: 'ERROR' });
  }

  // ==========================================
  // NETWORK STATUS
  // ==========================================

  async function initializeNetworkListener() {
    const status = await Network.getStatus();
    updateNetworkStatus(status);

    Network.addListener('networkStatusChange', (status) => {
      updateNetworkStatus(status);
    });
  }

  function updateNetworkStatus(status) {
    window.dispatchEvent(new CustomEvent('cybev:networkStatus', { 
      detail: status 
    }));

    if (!status.connected) {
      showToast('You are offline', 'long');
    }
  }

  // ==========================================
  // TOAST
  // ==========================================

  async function showToast(text, duration = 'short') {
    try {
      await Toast.show({
        text,
        duration,
        position: 'bottom'
      });
    } catch (error) {
      console.error('Toast error:', error);
    }
  }

  // ==========================================
  // PREFERENCES (LOCAL STORAGE)
  // ==========================================

  async function setPreference(key, value) {
    await Preferences.set({ key, value: JSON.stringify(value) });
  }

  async function getPreference(key) {
    const { value } = await Preferences.get({ key });
    return value ? JSON.parse(value) : null;
  }

  async function removePreference(key) {
    await Preferences.remove({ key });
  }

  // ==========================================
  // STATUS BAR
  // ==========================================

  async function setStatusBarColor(color) {
    try {
      await StatusBar.setBackgroundColor({ color });
    } catch (error) {
      // iOS doesn't support this
    }
  }

  async function setStatusBarStyle(style) {
    try {
      await StatusBar.setStyle({ style }); // 'DARK' or 'LIGHT'
    } catch (error) {
      console.error('StatusBar error:', error);
    }
  }

  // ==========================================
  // KEYBOARD
  // ==========================================

  function initializeKeyboard() {
    Keyboard.addListener('keyboardWillShow', (info) => {
      window.dispatchEvent(new CustomEvent('cybev:keyboardShow', { 
        detail: { height: info.keyboardHeight } 
      }));
    });

    Keyboard.addListener('keyboardWillHide', () => {
      window.dispatchEvent(new CustomEvent('cybev:keyboardHide'));
    });
  }

  // ==========================================
  // SPLASH SCREEN
  // ==========================================

  async function hideSplash() {
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.error('Splash error:', error);
    }
  }

  // ==========================================
  // INITIALIZE
  // ==========================================

  async function initialize() {
    try {
      // Get device info
      const deviceInfo = await getDeviceInfo();
      console.log('📱 Device:', deviceInfo?.model, deviceInfo?.platform);

      // Initialize features
      initializeDeepLinking();
      initializeNetworkListener();
      initializeKeyboard();
      await initializePushNotifications();

      // Hide splash after a short delay
      setTimeout(hideSplash, 1000);

      // Set status bar
      if (deviceInfo?.platform === 'android') {
        setStatusBarColor('#7c3aed');
      }
      setStatusBarStyle('LIGHT');

      console.log('✅ CYBEV Native Bridge ready');

      // Dispatch ready event
      window.dispatchEvent(new CustomEvent('cybev:nativeReady', {
        detail: { deviceInfo }
      }));

    } catch (error) {
      console.error('Bridge init error:', error);
    }
  }

  // ==========================================
  // EXPOSE GLOBAL API
  // ==========================================

  window.CYBEVNative = {
    // Device
    getDeviceInfo,
    
    // Push Notifications
    initializePushNotifications,
    
    // Local Notifications
    showLocalNotification,
    
    // Camera
    takePhoto,
    pickFromGallery,
    
    // Share
    nativeShare,
    
    // Haptics
    hapticLight,
    hapticMedium,
    hapticHeavy,
    hapticSuccess,
    hapticError,
    
    // Toast
    showToast,
    
    // Preferences
    setPreference,
    getPreference,
    removePreference,
    
    // Status Bar
    setStatusBarColor,
    setStatusBarStyle,
    
    // Splash
    hideSplash,
    
    // Utils
    isCapacitor: true,
    version: '1.1.0'
  };

  // Initialize when DOM is ready
  if (document.readyState === 'complete') {
    initialize();
  } else {
    window.addEventListener('load', initialize);
  }

})();
