<template>
  <div class="page-container" dir="rtl">
    
    <div v-if="!election" class="card">
      <h1 class="mt-0">ورود به سامانه رای‌گیری</h1>
      <p class="subtitle">لطفاً کد اختصاصی رای‌گیری خود را وارد کنید.</p>
      
      <div class="form-layout">
        <div class="input-icon-wrapper">
          <input 
            v-model="hashcode" 
            :type="showHashcode ? 'text' : 'password'" 
            placeholder="کد رای‌گیری" 
            class="input-field" 
            @keyup.enter="login"
          />
          
          <span 
            @click="showHashcode = !showHashcode" 
            class="input-icon-toggle"
          >
            <svg v-if="showHashcode" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
              <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
          </span>
        </div>

        <button @click="login" class="btn-primary" :disabled="loading">
          {{ loading ? 'در حال بررسی...' : 'ورود' }}
        </button>
      </div>

      <div v-if="error" class="alert-box alert-error text-center mt-20 m-0">{{ error }}</div>
    </div>

    <div v-else class="card">
      <h1 class="mt-0">{{ election.title }}</h1>
      <p class="subtitle">
        شما می‌توانید حداکثر <strong>{{ election.max_votes }}</strong> نامزد را انتخاب کنید.
      </p>
      
      <div class="candidates-list">
        <label 
          v-for="candidate in candidates" 
          :key="candidate.id" 
          class="candidate-item"
          :class="{ 'disabled': !selectedCandidates.includes(candidate.id) && selectedCandidates.length >= election.max_votes }"
        >
          <input 
            type="checkbox" 
            :value="candidate.id" 
            v-model="selectedCandidates"
            :disabled="!selectedCandidates.includes(candidate.id) && selectedCandidates.length >= election.max_votes"
          />
          <span>{{ candidate.name }}</span>
        </label>
      </div>

      <div class="form-layout mt-20">
        <button @click="submitVote" class="btn-primary" :disabled="loading">
           {{ loading ? 'در حال ثبت...' : 'ثبت رای' }}
        </button>
      </div>
      
      <div v-if="error" class="alert-box alert-error text-center mt-20 m-0">{{ error }}</div>
      <div v-if="successMsg" class="alert-box alert-success text-center mt-20 m-0">{{ successMsg }}</div>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';

const hashcode = ref('');
const showHashcode = ref(false);
const error = ref('');
const successMsg = ref('');
const loading = ref(false);

const election = ref(null);
const candidates = ref([]);
const selectedCandidates = ref([]);

const API_URL = import.meta.env.VITE_API_URL || '';

const login = async () => {
  if (!hashcode.value) return;
  
  error.value = '';
  loading.value = true;
  
  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hashcode: hashcode.value })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      election.value = data.election;
      candidates.value = data.candidates;
      selectedCandidates.value = data.existingVotes || [];
    } else {
      error.value = data.error || 'کد وارد شده نامعتبر است';
    }
  } catch (err) {
    error.value = 'خطا در اتصال به سرور';
  } finally {
    loading.value = false;
  }
};

const submitVote = async () => {
  error.value = '';
  successMsg.value = '';
  loading.value = true;
  
  try {
    const response = await fetch(`${API_URL}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        hashcode: hashcode.value,
        candidate_ids: selectedCandidates.value
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      successMsg.value = 'رای شما با امنیت کامل ثبت شد!';
    } else {
      error.value = data.error || 'خطا در ثبت رای';
    }
  } catch (err) {
    error.value = 'خطا در اتصال به سرور';
  } finally {
    loading.value = false;
  }
};
</script>