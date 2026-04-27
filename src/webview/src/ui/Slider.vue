<script setup lang="ts">
import { computed } from 'vue'
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

const props = withDefaults(
  defineProps<{
    modelValue?: number
    min?: number
    max?: number
    step?: number
    disabled?: boolean
  }>(),
  { min: 0, max: 100, step: 1 },
)

const emit = defineEmits<{ 'update:modelValue': [v: number] }>()

const sliderValue = computed({
  get: (): number[] => [props.modelValue ?? props.min],
  set: (v: number[]) => emit('update:modelValue', v[0] ?? props.min),
})
</script>

<template>
  <SliderRoot
    v-model="sliderValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    class="ui-slider"
  >
    <SliderTrack class="ui-slider__track">
      <SliderRange class="ui-slider__range" />
    </SliderTrack>
    <SliderThumb class="ui-slider__thumb" />
  </SliderRoot>
</template>
