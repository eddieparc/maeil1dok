<template><!-- Legacy template refs use the global host; no local toast UI. --></template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'
import type { ToastType } from '~/types/toast'

const toast = useToast()
const show = (message: string, type: ToastType = 'success') => toast.show({ message, type })
defineExpose({ show })
</script>
