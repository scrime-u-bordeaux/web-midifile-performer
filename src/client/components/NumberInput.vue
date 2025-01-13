<template>
  <div class="number-input-container">
    <div class="input-label"> {{ label }} </div>

    <div class="number-container">
      <input
        ref="input"
        type="number"
        :min="min"
        :max="max"
        :value="value"
        :step="step"
        @keydown="onKeyDown"
        @change="onChange"/>
        <!-- @input="onInput"/> -->
    </div>
  </div>
</template>

<style scoped>
input {
  user-select: none;
  width: 100%;
}
input::selection {
  caret-color: transparent;
  color: white;
  background: rgba(0,0,0,0.5);
  /* background: transparent; */
}
.input-label {
  margin-bottom: 8px;
  text-align: center;
}
.number-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>

<script>
export default {
  props: [ 'label','allowNaN', 'min', 'max', 'value', 'step' ],
  emits: ['input'],
  computed: {
    isDecimal() {
      return !Number.isInteger(this.step);
    },
    validInputKeys() {
      // it would be nice to be able to specify negative numbers :
      // const allValidKeys = ['0','1','2','3','4','5','6','7','8','9','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','-','.'];
      const allValidKeys = ['0','1','2','3','4','5','6','7','8','9','Backspace','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','.'];
      return this.isDecimal ? allValidKeys : allValidKeys.slice(0,-1);
    },
    numberKeys() {
      return validInputKeys.slice(0,10);
    }
  },
  methods: {

    // This method does three things :
    // 1. Prevent keydown events from bubbling outside the input
    // 2. Prevent invalid keys.
    // 3. Ensure that at most one decimal point is ever present in the input.

    onKeyDown(e) {
      var isNumber = function isNumber(value) {
        return typeof value === 'number' && isFinite(value);
      };

      if (e.key == 'Tab') return;

      // on Enter, let the event bubble and force blur on the input
      if (e.key == 'Enter') {
        e.target.blur();
        return;
      }
      
      // otherwise :

      // 1. Prevent these inputs from bubbling and triggering the MFP
      e.stopPropagation();

      // 2. Exclude any key that doesn't make sense with the number input.
      if (!this.validInputKeys.includes(e.key)) {
        e.preventDefault();
        return;
      }

      // 3. Prevent multiple decimal points.
      // This is a lot of logic, but a regexp can't replace it.
      // It would merely invalidate the field, not prevent the invalid display.

      // Because we cannot rely on the input element's value, which deletes trailing decimal points
      // (e.g. : it will interpret 1. as 1, but will STILL display 1.)
      // we keep track of the presence of a decimal point through a flag.

      const initialInputString = e.target.value

      // User is deleting a digit, **or** the decimal point in the case of decimal input.
      if (e.key === "Backspace") {
        if (this.isDecimal && this.decimalFlag && initialInputString.length === 1) { // We are erasing the decimal point
          // The length condition is 1 and not 2 because erasing from x.y directly produces x and not x.
          this.decimalFlag = false;
        }
        else { // Ordinary deletion case
          // We do not always delete the last character ;
          // but if we delete anything else, trailing decimal points are not an issue.
          const inputStringAfterBackspace = initialInputString.slice(0,-1)
          if (inputStringAfterBackspace.endsWith('.')) this.decimalFlag = true; // Contrary to the Number conversion, this *can* end with "."
        }
      }

      // User is inputting the decimal point themselves
      // The value doesn't actually change until they enter a decimal,
      // Which means that trailing decimal points (like 1., 2.) can exist.
      else if(e.key === "." && this.isDecimal) {
        if (initialInputString.length === 1 && !this.decimalFlag) this.decimalFlag = true; // This means : a solitary integer without a trailing decimal (e.g. excluding 2.)
        else e.preventDefault() // Cut the event line immediately if there would be multiple decimal points.
      }

      // todo : can we check if we're typing a minus sign that is not at the beginning of the input string ?
      else if (e.key === '-') {
        /* do smth */
        // const inputStringAfterMinus = initialInputString;
        if (!isNumber(parseFloat(initialInputString + '-'))) {
          // e.preventDefault();
          // console.log('not a nuber !!!!!')
        }
      }

      // One edge case is still not covered, however, and to examinate it, these two variables must be persisted.
      // They will be used in the input listener.

      this.lastKeyPressed = e.key
      this.valueOnKeyDown = e.target.valueAsNumber
    },
    // onInput(e) {
    onChange(e) {

      // Decimal point compliance edge case :
      // Ensure that scrolling up or down (which never produces trailing decimal points like 1.)
      // will reset the decimal flag.
      // This case is never triggered if the input is not decimal (because the value will always be an integer).

      if(
        (this.lastKeyPressed === "ArrowDown" || this.lastKeyPressed === "ArrowUp")
        && !Number.isInteger(this.valueOnKeyDown)
        && Number.isInteger(e.target.valueAsNumber)
      ) this.decimalFlag = false

      // We need to ensure the value displayed to the user stays in bounds
      // This is not enforced by min and max.
      // It's MUCH better to do it here than on keydown (because we have the actual value of the input)

      if(e.target.valueAsNumber < this.min) e.target.value = this.min
      if(e.target.valueAsNumber > this.max) e.target.value = this.max

      // If, after this, we have obtained a NaN and the input cannot support it, fall back to the min value.

      if(isNaN(e.target.valueAsNumber) && !this.allowNaN) e.target.value = this.min

      this.$emit('input',e)
    },
    reset() {
      this.$refs.input.value = this.value
    }
  },
};
</script>
