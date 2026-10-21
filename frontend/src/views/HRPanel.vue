<template>
  <div class="card" style="max-width: 800px; margin: 40px auto; padding: 20px;">
    <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
      <h2>👥 پنل منابع انسانی (HR)</h2>
      <button @click="logout" style="background: #ff4d4f; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">خروج</button>
    </div>

    <div style="display: flex; border-bottom: 2px solid #eee; margin-bottom: 20px;">
      <button @click="activeTab = 'approvals'" :style="activeTab === 'approvals' ? activeTabStyle : inactiveTabStyle">✅ مدیریت رای‌دهندگان</button>
      <button @click="activeTab = 'import'" :style="activeTab === 'import' ? activeTabStyle : inactiveTabStyle">📥 ورود گروهی (Import)</button>
      <button @click="activeTab = 'bot_users'; fetchBotUsers()" :style="activeTab === 'bot_users' ? activeTabStyle : inactiveTabStyle">🤖 کاربران ربات</button>
    </div>

    <div v-if="selectedElectionDetails" style="margin-bottom: 15px; padding: 10px; border-radius: 4px;" :style="{ background: selectedElectionDetails.status === 'Waiting' ? '#e8f5e9' : '#ffebee', color: selectedElectionDetails.status === 'Waiting' ? 'green' : 'red' }">
      <strong>وضعیت انتخابات: </strong>
      <span v-if="selectedElectionDetails.status === 'Waiting'">در انتظار شروع</span>
      <span v-else>در حال برگزاری / پایان یافته</span>
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
            <span v-else style="color: red; font-weight: bold;">تایید نشده</span>
          </td>
          <td style="padding: 10px; display: flex; gap: 10px;">
            <button 
                v-if="!user.allowed" 
                @click="triggerApprove(user.id)" 
                :disabled="selectedElectionDetails?.status !== 'Waiting'"
                :style="{ background: selectedElectionDetails?.status === 'Waiting' ? '#4CAF50' : '#ccc', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: selectedElectionDetails?.status === 'Waiting' ? 'pointer' : 'not-allowed' }"
            >
                تایید
            </button>
            <button 
                v-if="user.allowed" 
                @click="triggerReject(user.id)" 
                :disabled="selectedElectionDetails?.status !== 'Waiting'"
                :style="{ background: selectedElectionDetails?.status === 'Waiting' ? '#f44336' : '#ccc', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: selectedElectionDetails?.status === 'Waiting' ? 'pointer' : 'not-allowed' }"
            >
                لغو تایید (رد)
            </button>
          </td>
        </tr>
        <tr v-if="votersList.length === 0">
          <td colspan="4" style="text-align: center; padding: 20px;">هیچ کاربری در این انتخابات ثبت‌نام نکرده است.</td>
        </tr>
      </table>
    </div>

    <div v-if="activeTab === 'import'">
        <div style="margin-bottom: 20px;">
            <label>۱. ابتدا انتخابات مورد نظر را انتخاب کنید:</label>
            <select v-model="selectedElection" @change="fetchVoters" style="width: 100%; padding: 10px; margin-top: 5px;">
            <option disabled value="">یک مورد را انتخاب کنید...</option>
            <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
            </select>
        </div>

        <div v-if="selectedElection">
            <label>۲. لیست رای‌دهندگان را وارد کنید (هر نفر در یک خط، فرمت: <b>آیدی‌تلگرام,نام</b>):</label>
            <textarea 
            v-model="bulkInput" 
            placeholder="12345678, علی احمدی&#n87654321, سارا رضایی" 
            style="width: 100%; height: 200px; padding: 10px; margin-top: 10px; font-family: monospace; direction: ltr; text-align: left;"
            ></textarea>
            
            <button 
            @click="insertBulkVoters" 
            :disabled="selectedElectionDetails?.status !== 'Waiting'"
            :style="{ marginTop: '15px', width: '100%', padding: '12px', background: selectedElectionDetails?.status === 'Waiting' ? '#2196F3' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', cursor: selectedElectionDetails?.status === 'Waiting' ? 'pointer' : 'not-allowed' }"
            >
            وارد کردن به سیستم (Insert)
            </button>
        </div>
        <div v-else style="color: orange; padding: 10px; background: #fff3e0; border-radius: 4px;">
            لطفاً برای نمایش کادر ورود اطلاعات، ابتدا یک انتخابات را از لیست بالا انتخاب کنید.
        </div>
    </div>
    <div v-if="activeTab === 'bot_users'">
      <div style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; color: #0d47a1; border-radius: 4px;">
        <strong>لیست کل کاربران:</strong> افرادی که دکمه Start ربات را زده‌اند در اینجا نمایش داده می‌شوند.
      </div>
      
      <table style="width: 100%; border-collapse: collapse; text-align: left;" dir="rtl">
        <tr style="background-color: #f5f5f5;">
          <th style="padding: 10px;">آیدی تلگرام</th>
          <th style="padding: 10px;">نام</th>
          <th style="padding: 10px;">نام خانوادگی</th>
          <th style="padding: 10px;">یوزرنیم</th>
          <th style="padding: 10px;">تاریخ عضویت</th>
        </tr>
        <tr v-for="user in botUsers" :key="user.telegram_id" style="border-bottom: 1px solid #eee;">
          <td style="padding: 10px; font-family: monospace;">{{ user.telegram_id }}</td>
          <td style="padding: 10px;">{{ user.first_name || '-' }}</td>
          <td style="padding: 10px;">{{ user.last_name || '-' }}</td>
          <td style="padding: 10px;" dir="ltr">{{ user.username ? '@' + user.username : '-' }}</td>
          <td style="padding: 10px;" dir="ltr">{{ new Date(user.joined_at).toLocaleString('fa-IR') }}</td>
        </tr>
        <tr v-if="botUsers.length === 0">
          <td colspan="5" style="text-align: center; padding: 20px;">هنوز هیچ کاربری ربات را استارت نزده است.</td>
        </tr>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const activeTab = ref('approvals');
const elections = ref([]);
const selectedElection = ref('');
const votersList = ref([]);
const bulkInput = ref('');
const botUsers = ref([]);

const activeTabStyle = "flex: 1; padding: 12px; border: none; border-bottom: 3px solid #2196F3; background: transparent; font-weight: bold; color: #2196F3; cursor: pointer;";
const inactiveTabStyle = "flex: 1; padding: 12px; border: none; border-bottom: 3px solid transparent; background: transparent; color: #777; cursor: pointer;";
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const selectedElectionDetails = computed(() => {
  return elections.value.find(e => e.id === selectedElection.value) || null;
});

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
    const data = await fetchAuth(`${API_URL}/api/elections`);
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
    } else {
      alert(data.error);
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
    } else {
      alert(data.error);
    }
  } catch (err) {}
};

const insertBulkVoters = async () => {
  if (!bulkInput.value.trim()) {
    alert('لطفا لیست کاربران را وارد کنید.');
    return;
  }

  const lines = bulkInput.value.split('\n');
  const parsedVoters = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(',');
    if (parts.length >= 2) {
      parsedVoters.push({
        telegram_id: parts[0].trim(),
        name: parts[1].trim()
      });
    }
  }

  if (parsedVoters.length === 0) {
    alert('فرمت اطلاعات وارد شده صحیح نیست. حتما از کاما (,) برای جداسازی استفاده کنید.');
    return;
  }

  try {
    const data = await fetchAuth(`${API_URL}/api/admin/elections/${selectedElection.value}/voters/import`, {
      method: 'POST',
      body: JSON.stringify({ voters: parsedVoters })
    });

    if (data.success) {
      alert(data.message);
      bulkInput.value = ''; 
      activeTab.value = 'approvals';
      fetchVoters();
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('خطا در ارتباط با سرور هنگام ذخیره گروهی.');
  }
};

const fetchBotUsers = async () => {
  try {
    const data = await fetchAuth(`${API_URL}/api/admin/bot-users`);
    if (data.success) {
      botUsers.value = data.users;
    } else {
      alert(data.error || 'خطا در دریافت لیست کاربران');
    }
  } catch (err) {
    alert('خطا در ارتباط با سرور هنگام دریافت کاربران ربات.');
  }
};

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_panels');
  router.push('/admin/login');
};
</script>