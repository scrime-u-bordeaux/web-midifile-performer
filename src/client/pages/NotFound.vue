<template>
  <div class="container">
    <h2>
      {{$t('notFound')}}
    </h2>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 25rem;
}
h2 {
  color: #666;
  font-style: italic;
}
</style>

<script>
export default {};
</script>
