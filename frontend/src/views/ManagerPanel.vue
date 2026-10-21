<template>
  <div class="card" style="max-width: 800px; margin: 40px auto; padding: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <h2>👔 پنل مدیریت ارشد (Manager)</h2>
      <button @click="logout" style="background: #ff4d4f; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">خروج</button>
    </div>

    <div style="display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px;">
      <button @click="activeTab = 'elections'" :style="activeTab === 'elections' ? activeTabStyle : inactiveTabStyle">📊 مدیریت انتخابات</button>
      <button @click="activeTab = 'placeholder'" :style="activeTab === 'placeholder' ? activeTabStyle : inactiveTabStyle">📄 بخش آزمایشی</button>
    </div>

    <div v-if="activeTab === 'elections'">
      <div style="margin-bottom: 20px;">
        <label>انتخابات مورد نظر را انتخاب کنید:</label>
        <select v-model="selectedElection" @change="updateSelectedDetails" style="width: 100%; padding: 10px; margin-top: 5px;">
          <option disabled value="">یک مورد را انتخاب کنید...</option>
          <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
        </select>
      </div>

      <div v-if="selectedElectionDetails" style="background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: right;">
        <h3 style="margin-top: 0;">وضعیت فعلی: 
          <span v-if="selectedElectionDetails.status === 'Waiting'" style="color: orange;">در انتظار شروع</span>
          <span v-else-if="selectedElectionDetails.status === 'Started'" style="color: green;">در حال برگزاری (شروع شده)</span>
          <span v-else style="color: red;">پایان یافته</span>
        </h3>

        <div style="display: flex; gap: 15px; margin-top: 20px;">
          <!-- دکمه بررسی کاربران -->
          <button 
            @click="checkBotStatus" 
            style="flex: 1; padding: 12px; background: #607D8B; color: white; border: none; border-radius: 4px; font-size: 15px; cursor: pointer;"
          >
            🔍 بررسی دسترسی ربات کاربران
          </button>

          <!-- دکمه شروع انتخابات (فقط در حالت Waiting فعال است) -->
          <button 
            @click="startElection" 
            :disabled="selectedElectionDetails.status !== 'Waiting'"
            :style="{ flex: 1, padding: '12px', background: selectedElectionDetails.status === 'Waiting' ? '#4CAF50' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', fontSize: '15px', cursor: selectedElectionDetails.status === 'Waiting' ? 'pointer' : 'not-allowed' }"
          >
            🚀 شروع انتخابات و ارسال کلیدها
          </button>
        </div>
      </div>
      <div v-else style="color: gray; text-align: center; padding: 20px;">
        برای مشاهده گزینه‌ها، یک انتخابات را انتخاب کنید.
      </div>
    </div>

    <div v-if="activeTab === 'placeholder'">
      <p>لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ است...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const activeTab = ref('elections');
const elections = ref([]);
const selectedElection = ref('');
const selectedElectionDetails = ref(null);

const activeTabStyle = "flex: 1; padding: 12px; border: none; border-bottom: 3px solid #2196F3; background: transparent; font-weight: bold; color: #2196F3; cursor: pointer;";
const inactiveTabStyle = "flex: 1; padding: 12px; border: none; border-bottom: 3px solid transparent; background: transparent; color: #777; cursor: pointer;";
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const fetchAuth = async (url, options = {}) => {
  const token = localStorage.getItem('admin_token');
  if (!token) return logout();

  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...options.headers }
  });

  if (res.status === 401 || res.status === 403) {
    logout();
    throw new Error('Unauthorized');
  }
  return res.json();
};

onMounted(async () => {
  await loadElections();
});

const loadElections = async () => {
  try {
    const data = await fetchAuth(`${API_URL}/api/elections`);
    if (data.success) elections.value = data.elections;
  } catch (err) {}
};

const updateSelectedDetails = () => {
  selectedElectionDetails.value = elections.value.find(e => e.id === selectedElection.value) || null;
};

const checkBotStatus = async () => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${selectedElection.value}/check-status`);    
    if (data.success) alert(data.message);
  } catch (err) {}
};

const startElection = async () => {
  if (!confirm('آیا مطمئن هستید؟ این کار انتخابات را شروع کرده و برای تمام افراد تایید شده کلید ارسال می‌کند.')) return;
  
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/manager/elections/${selectedElection.value}/start`, { method: 'POST' });
    if (data.success) {
      alert(data.message);
      await loadElections();
      updateSelectedDetails();
    } else {
      alert(data.error);
    }
  } catch (err) {}
};

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_panels');
  router.push('/admin/login');
};
</script>