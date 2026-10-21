<template>
  <div class="page-container" dir="rtl">
    <div class="card panel-wide">
      
      <!-- هدر پنل -->
      <div class="panel-header">
        <h2>👥 پنل منابع انسانی (HR)</h2>
        <button @click="logout" class="btn-danger btn-small">خروج</button>
      </div>

      <!-- منوی تب‌ها -->
      <div class="tabs-container">
        <button 
          @click="activeTab = 'approvals'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'approvals' }"
        >
          مدیریت رای‌دهندگان
        </button>
        <button 
          @click="activeTab = 'import'" 
          class="tab-btn" 
          :class="{ active: activeTab === 'import' }"
        >
          ورود گروهی
        </button>
        <button 
          @click="activeTab = 'bot_users'; fetchBotUsers()" 
          class="tab-btn" 
          :class="{ active: activeTab === 'bot_users' }"
        >
          کاربران ربات
        </button>
      </div>

      <div 
        v-if="selectedElectionDetails" 
        class="alert-box" 
        :class="selectedElectionDetails.status === 'Waiting' ? 'alert-success' : 'alert-error'"
      >
        <strong>وضعیت انتخابات: </strong>
        <span v-if="selectedElectionDetails.status === 'Waiting'">در انتظار شروع</span>
        <span v-else>در حال برگزاری / پایان یافته</span>
      </div>

      <div v-if="activeTab === 'approvals'">
        <div class="form-layout" style="align-items: stretch;">
          <label class="text-dark">انتخابات مورد نظر را انتخاب کنید:</label>
          <select v-model="selectedElection" @change="fetchVoters" class="input-field full-width">
            <option disabled value="">یک مورد را انتخاب کنید...</option>
            <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
          </select>
        </div>

        <table v-if="selectedElection" class="data-table mt-20">
          <tr>
            <th>تلگرام آیدی</th>
            <th>نام</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
          <tr v-for="user in votersList" :key="user.id">
            <td dir="ltr" style="text-align: right; font-family: var(--mono);">{{ user.telegram_id }}</td>
            <td>{{ user.name }}</td>
            <td>
              <span v-if="user.allowed" class="text-success" style="margin: 0; font-weight: bold;">تایید شده</span>
              <span v-else class="text-error" style="margin: 0; font-weight: bold;">تایید نشده</span>
            </td>
            <td class="action-cell">
              <button 
                v-if="!user.allowed" 
                @click="triggerApprove(user.id)" 
                class="btn-success btn-small"
                :disabled="selectedElectionDetails?.status !== 'Waiting'"
              >
                تایید
              </button>
              <button 
                v-if="user.allowed" 
                @click="triggerReject(user.id)" 
                class="btn-danger btn-small"
                :disabled="selectedElectionDetails?.status !== 'Waiting'"
              >
                لغو تایید
              </button>
            </td>
          </tr>
          <tr v-if="votersList.length === 0">
            <td colspan="4" style="text-align: center; color: var(--text-muted);">هیچ کاربری در این انتخابات ثبت‌نام نکرده است.</td>
          </tr>
        </table>
      </div>

      <div v-if="activeTab === 'import'">
        <div class="form-layout" style="align-items: stretch;">
          <label class="text-dark">۱. ابتدا انتخابات مورد نظر را انتخاب کنید:</label>
          <select v-model="selectedElection" @change="fetchVoters" class="input-field full-width">
            <option disabled value="">یک مورد را انتخاب کنید...</option>
            <option v-for="el in elections" :key="el.id" :value="el.id">{{ el.title }}</option>
          </select>
        </div>

        <div v-if="selectedElection" class="form-layout mt-20" style="align-items: stretch;">
          <label class="text-dark">۲. لیست رای‌دهندگان را وارد کنید (هر نفر در یک خط، فرمت: <b>آیدی‌تلگرام,نام</b>):</label>
          <textarea 
            v-model="bulkInput" 
            placeholder="12345678, علی احمدی&#n87654321, سارا رضایی" 
            class="input-field full-width"
            style="height: 200px; font-family: var(--mono); direction: ltr; text-align: left;"
          ></textarea>
          
          <button 
            @click="insertBulkVoters" 
            class="btn-primary full-width"
            :disabled="selectedElectionDetails?.status !== 'Waiting'"
          >
            وارد کردن به سیستم (Insert)
          </button>
        </div>
        <div v-else class="alert-box alert-info mt-20">
          لطفاً برای نمایش کادر ورود اطلاعات، ابتدا یک انتخابات را از لیست بالا انتخاب کنید.
        </div>
      </div>

      <div v-if="activeTab === 'bot_users'">
        <div class="alert-box alert-info">
          <strong>لیست کل کاربران:</strong> افرادی که دکمه Start ربات را زده‌اند در اینجا نمایش داده می‌شوند.
        </div>
        
        <table class="data-table">
          <tr>
            <th>آیدی تلگرام</th>
            <th>نام</th>
            <th>نام خانوادگی</th>
            <th>یوزرنیم</th>
            <th>تاریخ عضویت</th>
          </tr>
          <tr v-for="user in botUsers" :key="user.telegram_id">
            <td style="font-family: var(--mono);" dir="ltr">{{ user.telegram_id }}</td>
            <td>{{ user.first_name || '-' }}</td>
            <td>{{ user.last_name || '-' }}</td>
            <td dir="ltr" style="font-family: var(--mono);">{{ user.username ? '@' + user.username : '-' }}</td>
            <td dir="ltr">{{ new Date(user.joined_at).toLocaleString('fa-IR') }}</td>
          </tr>
          <tr v-if="botUsers.length === 0">
            <td colspan="5" style="text-align: center; color: var(--text-muted);">هنوز هیچ کاربری ربات را استارت نزده است.</td>
          </tr>
        </table>
      </div>

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

const API_URL = import.meta.env.VITE_API_URL || '';

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