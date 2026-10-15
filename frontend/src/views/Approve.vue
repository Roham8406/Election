<template>
  <div class="page-container" dir="rtl">
    <div class="card" style="max-width: 800px;">
      <h1>پنل مدیریت رای‌دهندگان</h1>
      
      <div v-if="loading" style="text-align: center;">در حال دریافت لیست...</div>
      
      <div v-else-if="voters.length > 0" style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: right;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border);">
              <th style="padding: 10px;">نام رای‌دهنده</th>
              <th style="padding: 10px;">انتخابات</th>
              <th style="padding: 10px;">عملیات</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="voter in voters" :key="voter.id" style="border-bottom: 1px solid var(--border);">
              <td style="padding: 10px;">{{ voter.name }}</td>
              <td style="padding: 10px;">{{ voter.election_title }}</td>
              <td style="padding: 10px;">
                <button 
                  @click="approveVoter(voter.id)" 
                  class="btn-primary" 
                  style="margin: 0; padding: 5px 15px; font-size: 14px;"
                  :disabled="actionLoading === voter.id"
                >
                  {{ actionLoading === voter.id ? 'در حال ارسال...' : 'تایید و ارسال کد' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <p v-else style="text-align: center; color: gray;">در حال حاضر هیچ کاربری در انتظار تایید نیست.</p>
      
      <p v-if="error" class="text-error" style="margin-top: 15px;">{{ error }}</p>
      <p v-if="successMsg" class="text-success" style="margin-top: 15px;">{{ successMsg }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const API_URL = import.meta.env.VITE_API_URL;
const voters = ref([]);
const loading = ref(true);
const actionLoading = ref(null);
const error = ref('');
const successMsg = ref('');

const fetchVoters = async () => {
  try {
    const response = await fetch(`${API_URL}/api/admin/voters`);
    voters.value = await response.json();
  } catch (err) {
    error.value = 'خطا در ارتباط با سرور';
  } finally {
    loading.value = false;
  }
};

const approveVoter = async (voterId) => {
  error.value = '';
  successMsg.value = '';
  actionLoading.value = voterId;
  
  try {
    const response = await fetch(`${API_URL}/api/admin/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: voterId })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successMsg.value = data.message;
      voters.value = voters.value.filter(v => v.id !== voterId);
    } else {
      error.value = data.error || 'خطا در تایید کاربر';
    }
  } catch (err) {
    error.value = 'خطا در ارتباط با سرور';
  } finally {
    actionLoading.value = null;
  }
};

onMounted(fetchVoters);
</script>