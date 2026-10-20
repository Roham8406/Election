<template>
  <div class="card" style="max-width: 600px; margin: 50px auto;">
    <h2>داشبورد مدیریت</h2>
    
    <div v-if="error" style="color: red; text-align: center;">{{ error }}</div>
    
    <div v-else>
      <p>خوش آمدید! بر اساس نقش‌های شما، به بخش‌های زیر دسترسی دارید:</p>
      
      <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
        <router-link 
          v-for="panel in panels" 
          :key="panel.name" 
          :to="panel.panel_url"
          style="padding: 15px; background: #e0e0e0; text-decoration: none; border-radius: 8px; color: black; font-weight: bold; text-align: center;"
        >
          👉 ورود به پنل {{ panel.name }}
        </router-link>
      </div>

      <button @click="logout" style="margin-top: 30px; width: 100%; padding: 10px; background: #ff4d4f; color: white; border: none; border-radius: 4px; cursor: pointer;">
        خروج
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const panels = ref([]);
const error = ref('');

onMounted(() => {
  const token = localStorage.getItem('admin_token');
  const panelsStr = localStorage.getItem('admin_panels');
  
  if (!token || !panelsStr) {
    router.push('/admin/login');
    return;
  }

  const storedPanels = JSON.parse(panelsStr);
  if (storedPanels.length === 0) {
    error.value = 'شما هیچ نقش فعالی در سیستم ندارید.';
  } else {
    panels.value = storedPanels;
  }
});

const logout = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_panels');
  router.push('/admin/login');
};
</script>