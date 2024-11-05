self.onmessage = (message) => {

  if(!!message.data) {
    self.timeout = self.setTimeout(
      () => self.postMessage({
        pair: message.data.pair,
        start: message.data.start,
        dt: message.data.dt,
      }),

      message.data.timeout_duration
    )
  }

  else if(!!self.timeout) {
    self.clearTimeout(self.timeout)
  }
}
