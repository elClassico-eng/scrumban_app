<template>
  <div class="h-screen flex overflow-hidden">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />
      <main class="flex-1 overflow-auto p-6 min-w-0">
        <slot />
      </main>
    </div>
    <IntroduceModal />
  </div>
</template>