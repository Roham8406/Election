<template>
  <div class="page-container" dir="rtl">
    <div class="card panel-md">
      <h1>نتایج انتخابات</h1>
      
      <div class="section-card bg-shaded">
        <p class="form-label mt-0">لطفاً انتخابات مورد نظر را انتخاب کنید:</p>
        
        <div v-if="loadingElections" class="text-center text-muted mt-15">
          ⏳ در حال دریافت لیست انتخابات‌ها...
        </div>
        
        <select 
          v-else 
          v-model="selectedElectionId" 
          @change="fetchResults(selectedElectionId)"
          class="input-field full-width mt-5"
          style="cursor: pointer;"
        >
          <option value="" disabled selected>-- یک انتخابات را انتخاب کنید --</option>
          <option v-for="election in elections" :key="election.id" :value="election.id">
            🗳 {{ election.title }}
          </option>
        </select>
      </div>

      <div v-if="loadingResults" class="text-center mt-20">
        <p class="text-dark" style="font-weight: bold;">⏳ در حال استخراج آرا و بررسی امضاهای دیجیتال...</p>
        <small class="text-muted">(این عملیات برای جلوگیری از تقلب کمی زمان‌بر است)</small>
      </div>

      <div v-if="error" class="alert-box alert-error text-center mt-20">
        <h3 class="mt-0 mb-15">{{ error }}</h3>
        <p class="m-0">{{ errorDetails }}</p>
      </div>

      <div v-if="!loadingResults && !error && results.length > 0" class="mt-20">
        
        <div class="alert-box alert-success text-center mb-20">
          <strong>{{ successMessage }}</strong><br>
          <small class="text-dark">تعداد برگه رای تایید شده: {{ totalVoters }}</small>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th>نام کاندیدا</th>
              <th class="text-center">تعداد رای تایید شده</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(cand, index) in results" :key="index">
              <td class="text-dark" style="font-weight: bold;">{{ cand.name }}</td>
              <td class="text-center text-large text-accent">
                {{ cand.votes }}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="text-center text-dark mt-15" style="font-weight: bold;">
           تعداد آرای سفید: {{ blankVotes }}
        </div>
      </div>
      
      <div v-if="!loadingResults && !error && selectedElectionId && results.length === 0" class="text-center text-muted mt-20">
        <p>هنوز هیچ رای معتبری برای این انتخابات ثبت نشده است.</p>
      </div>
      
      <template v-if="votersList.length > 0">
        <hr class="divider" />
        <div class="section-card mt-0">
          <h3 class="text-dark mt-0">📜 دفتر کل آرا (Bulletin Board)</h3>
          <p class="text-muted mb-15" style="font-size: 0.9em;">
            کدهای زیر، کلید عمومی (Public Key) تمام کسانی است که رای‌شان در سیستم ثبت و شمرده شده است. شما می‌توانید با جستجوی کلید عمومی خود، حضور رای‌تان را پیگیری کنید.
          </p>
          
          <div class="bulletin-board">
            <div v-for="(pubKey, index) in votersList" :key="index" class="bulletin-board-item">
              {{ index + 1 }}. {{ pubKey }}
            </div>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const API_URL = import.meta.env.VITE_API_URL || '';

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
    elections.value = data.elections;
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
    const token = localStorage.getItem('admin_token');
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/api/results/${id}`, {
      method: 'GET',
      headers: headers
    });
    const data = await response.json();
    
    if (response.ok && data.success) {
      results.value = data.results;
      successMessage.value = data.message;
      totalVoters.value = data.total_verified_voters;
      votersList.value = data.voters_list;
      blankVotes.value = data.blank_votes; 
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