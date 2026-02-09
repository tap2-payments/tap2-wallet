import axios from 'axios';

// API base URL - configure for different environments
const API_BASE_URL = __DEV__ ? 'http://localhost:3001/api/v1' : 'https://api.tap2wallet.com/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // TODO: Sprint 1 - Implement auth token retrieval with AsyncStorage
    // 1. Add @react-native-async-storage/async-storage to dependencies
    // 2. Import AsyncStorage: import AsyncStorage from '@react-native-async-storage/async-storage';
    // 3. Retrieve and attach token:
    //    const token = await AsyncStorage.getItem('authToken');
    //    if (token) {
    //      config.headers.Authorization = `Bearer ${token}`;
    //    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors (401, 403, 500, etc.)
    if (error.response?.status === 401) {
      // TODO: Sprint 1 - Handle unauthorized - redirect to login screen
      // 1. Clear stored auth token from AsyncStorage
      // 2. Navigate to Auth screen using React Navigation
      // 3. Optionally show error message to user
    }
    return Promise.reject(error);
  }
);

export { apiClient as axiosInstance };
export default apiClient;
