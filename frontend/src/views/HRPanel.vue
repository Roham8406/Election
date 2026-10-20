<template>
  <div class="card" style="max-width: 800px; margin: 40px auto; padding: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <h2>👥 پنل منابع انسانی (HR)</h2>
      <button @click="logout" style="background: #ff4d4f; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">خروج</button>
    </div>

    <div style="display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px;">
      <button @click="activeTab = 'approvals'" :style="activeTab === 'approvals' ? activeTabStyle : inactiveTabStyle">✅ مدیریت رای‌دهندگان</button>
      <button @click="activeTab = 'placeholder'" :style="activeTab === 'placeholder' ? activeTabStyle : inactiveTabStyle">📄 بخش آزمایشی</button>
    </div>

    <div v-if="activeTab === 'approvals'">
      <div style="margin-bottom: 20px;">
        <label>انتخابات مورد نظر را انتخاب کنید:</label>
        <select v-model="selectedElection" @change="fetchVoters" style="width: 100%; padding: 10px; margin-top: 5px;">
          <option disabled value="">یک مورد را انتخاب کنید...</option>
          <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
        </select>
      </div>

      <table v-if="selectedElection" style="width: 100%; border-collapse: collapse; text-align: left;" dir="rtl">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px;">تلگرام آیدی</th>
          <th style="padding: 10px;">نام</th>
          <th style="padding: 10px;">وضعیت</th>
          <th style="padding: 10px;">عملیات</th>
        </tr>
        <tr v-for="user in votersList" :key="user.id" style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px;">{{ user.telegram_id }}</td>
          <td style="padding: 10px;">{{ user.name }}</td>
          <td style="padding: 10px;">
            <span v-if="user.allowed" style="color: green; font-weight: bold;">تایید شده</span>
            <span v-else style="color: orange; font-weight: bold;">در انتظار</span>
          </td>
          <td style="padding: 10px; display: flex; gap: 10px;">
            <button 
                v-if="!user.allowed" 
                @click="triggerApprove(user.id)" 
                style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
            >
                تایید
            </button>
            <button 
                v-if="!user.allowed" 
                @click="triggerReject(user.id)" 
                style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;"
            >
                رد
            </button>
            <span v-else style="color: gray; font-size: 0.9em;">تایید شده</span>
          </td>
        </tr>
        <tr v-if="votersList.length === 0">
          <td colspan="4" style="text-align: center; padding: 20px;">هیچ کاربری در این انتخابات ثبت‌نام نکرده است.</td>
        </tr>
      </table>
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
const activeTab = ref('approvals');
const elections = ref([]);
const selectedElection = ref('');
const votersList = ref([]);

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
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/elections`);
    if (data.success) elections.value = data.elections;
  } catch (err) {}
});

const fetchVoters = async () => {
  if (!selectedElection.value) return;
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/elections/${selectedElection.value}/voters`);
    if (data.success) votersList.value = data.voters;
  } catch (err) {}
};

const triggerApprove = async (userId) => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/voters/${userId}/approve`, { method: 'POST' });
    if (data.success) {
      const userIndex = votersList.value.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        votersList.value[userIndex].allowed = true;
      }
    }
  } catch (err) {}
};

const triggerReject = async (userId) => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/voters/${userId}/reject`, { method: 'POST' });
    if (data.success) {
      const userIndex = votersList.value.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        votersList.value[userIndex].allowed = false;
        votersList.value[userIndex].rejected = true;
      }
    }
  } catch (err) {}
};

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_panels');
  router.push('/admin/login');
};
</script>