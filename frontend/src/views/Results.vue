<template>
  <div class="page-container" dir="rtl">
    <div class="card" style="max-width: 700px;">
      <h1>📊 نتایج زنده انتخابات</h1>
      
      <div style="margin-bottom: 30px; background: #f5f5f5; padding: 15px; border-radius: 8px;">
        <p style="margin-top: 0; font-weight: bold;">لطفاً انتخابات مورد نظر را انتخاب کنید:</p>
        
        <div v-if="loadingElections" style="text-align: center; color: gray;">
          ⏳ در حال دریافت لیست انتخابات‌ها...
        </div>
        
        <select 
          v-else 
          v-model="selectedElectionId" 
          @change="fetchResults(selectedElectionId)"
          style="width: 100%; padding: 12px; border-radius: 6px; border: 1px solid var(--border); font-family: inherit; font-size: 16px; cursor: pointer;"
        >
          <option value="" disabled selected>-- یک انتخابات را انتخاب کنید --</option>
          <option v-for="election in elections" :key="election.id" :value="election.id">
            🗳 {{ election.title }}
          </option>
        </select>
      </div>

      <div v-if="loadingResults" style="text-align: center; margin-top: 20px;">
        <p>⏳ در حال استخراج آرا و بررسی امضاهای دیجیتال...</p>
        <small style="color: gray;">(این عملیات برای جلوگیری از تقلب کمی زمان‌بر است)</small>
      </div>

      <div v-if="error" class="text-error" style="background: #ffebee; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <h3 style="margin-top: 0;">{{ error }}</h3>
        <p style="margin-bottom: 0;">{{ errorDetails }}</p>
      </div>

      <div v-if="!loadingResults && !error && results.length > 0" style="margin-top: 20px;">
        <div style="background: #e8f5e9; color: #2e7d32; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <strong>{{ successMessage }}</strong><br>
          <small>تعداد برگه رای تایید شده: {{ totalVoters }}</small>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: right; margin-top: 10px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border); background: #f9f9f9;">
              <th style="padding: 12px; border-top-right-radius: 8px;">نام کاندیدا</th>
              <th style="padding: 12px; text-align: center; border-top-left-radius: 8px;">تعداد رای تایید شده</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(cand, index) in results" :key="index" style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px; font-weight: bold;">{{ cand.name }}</td>
              <td style="padding: 12px; text-align: center; font-size: 1.2em; color: var(--primary-color);">
                {{ cand.votes }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-if="!loadingResults && !error && selectedElectionId && results.length === 0" style="text-align: center; margin-top: 20px; color: gray;">
        <p>هنوز هیچ رای معتبری برای این انتخابات ثبت نشده است.</p>
      </div>
      
      <div style="margin-top: 15px; font-weight: bold; text-align: center;">
         تعداد آرای سفید: {{ blankVotes }}
      </div>

      <hr style="margin: 40px 0; border: 0; border-top: 1px solid #ddd;" />

      <div v-if="votersList.length > 0" style="background: #fdfdfd; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h3 style="margin-top: 0;">📜 دفتر کل آرا (Bulletin Board)</h3>
        <p style="font-size: 0.9em; color: gray;">
          کدهای زیر، کلید عمومی (Public Key) تمام کسانی است که رای‌شان در سیستم ثبت و شمرده شده است. شما می‌توانید با محاسبه کلید عمومی خود، حضور رای‌تان را پیگیری کنید.
        </p>
        
        <div style="max-height: 200px; overflow-y: auto; background: #222; color: #0f0; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 11px; text-align: left; direction: ltr;">
          <div v-for="(pubKey, index) in votersList" :key="index" style="margin-bottom: 5px; word-break: break-all;">
            {{ index + 1 }}. {{ pubKey }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const elections = ref([]);
const selectedElectionId = ref('');
const loadingElections = ref(true);

const loadingResults = ref(false);
const error = ref('');
const errorDetails = ref('');
const results = ref([]);
const successMessage = ref('');
const totalVoters = ref(0);
const votersList = ref([]);
const blankVotes = ref(0);

const fetchElections = async () => {
  try {
    const response = await fetch(`${API_URL}/api/elections`);
    const data = await response.json();
    elections.value = data;
  } catch (err) {
    console.error('خطا در دریافت لیست انتخابات‌ها');
  } finally {
    loadingElections.value = false;
  }
};

const fetchResults = async (id) => {
  if (!id) return;
  loadingResults.value = true;
  error.value = '';
  errorDetails.value = '';
  results.value = [];
  
  try {
    const response = await fetch(`${API_URL}/api/results/${id}`);
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.value = data.results;
      successMessage.value = data.message;
      totalVoters.value = data.total_verified_voters;
      votersList.value = data.voters_list;
      blankVotes.value = blank_votes; 
    } else {
      error.value = data.error || 'خطا در دریافت نتایج';
      errorDetails.value = data.details || '';
    }
  } catch (err) {
    error.value = 'خطا در ارتباط با سرور بک‌ند.';
  } finally {
    loadingResults.value = false;
  }
};

onMounted(() => {
  fetchElections();
});
</script>