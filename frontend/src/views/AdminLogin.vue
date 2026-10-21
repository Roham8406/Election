<template>
  <div class="page-container" dir="rtl">
    <div class="card">
      <h2>ورود به پنل مدیریت</h2>

      <form @submit.prevent="handleLogin" class="form-layout">
        <input 
          v-model="username" 
          type="text" 
          placeholder="Username" 
          required 
          class="input-field" 
        />
        <input 
          v-model="password" 
          type="password" 
          placeholder="Password" 
          required 
          class="input-field" 
        />
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'در حال بررسی...' : 'ورود' }}
        </button>
      </form>
      
      <p v-if="error" class="text-error mt-15">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();
const API_URL = import.meta.env.VITE_API_URL || '';

const handleLogin = async () => {
  error.value = '';
  loading.value = true;

  try {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_panels', JSON.stringify(data.panels)); 
      
      if (data.panels.length === 1) {
        router.push(data.panels[0].panel_url);
      } else {
        router.push('/admin/dashboard');
      }
    } else {
      error.value = data.error || 'اطلاعات ورود نامعتبر است.';
    }
  } catch (err) {
    error.value = 'خطا در ارتباط با سرور';
  } finally {
    loading.value = false;
  }
};
</script>