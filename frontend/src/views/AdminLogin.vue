<template>
  <div class="card" style="max-width: 400px; margin: 50px auto;">
    <h2>Admin Login</h2>
    <form @submit.prevent="handleLogin">
      <input v-model="username" type="text" placeholder="Username" required style="width: 100%; margin-bottom: 15px; padding: 10px;" />
      <input v-model="password" type="password" placeholder="Password" required style="width: 100%; margin-bottom: 15px; padding: 10px;" />
      <button type="submit" style="width: 100%; padding: 10px; background: #333; color: white;">Login</button>
    </form>
    <p v-if="error" style="color: red; margin-top: 10px;">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const username = ref('');
const password = ref('');
const error = ref('');
const router = useRouter();
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const handleLogin = async () => {
  try {
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    const data = await res.json();
    
    if (data.success) {
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_roles', JSON.stringify(data.roles)); 
      router.push('/admin/dashboard');
    } else {
      error.value = data.error;
    }
  } catch (err) {
    error.value = 'Connection error';
  }
};
</script>