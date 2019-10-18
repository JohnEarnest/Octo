/**
* Input Emulation
**/

function injectGestureControls(screen, keyup, keydown) {
  const ael = (event, listener) => screen.addEventListener(event, listener, { passive: false })
  const rel = (event, listener) => screen.removeEventListener(event, listener, { passive: false })
  const pd  = event => event.preventDefault()

  ael('touchstart', start => {
    start.stopPropagation()
    const down = key => keydown({key, preventDefault:_=>_})
    const up   = key => keyup  ({key, preventDefault:_=>_})

    if (start.touches.length == 1) {
      // directional or action
      let vdirs = []
      const tt = end => (up('e'),rel('touchend',tt),pd(end)) // release action
      const tm = move => {
        // this has definitely become a directional input...
        if (cancel) cancel = clearTimeout(cancel)
        const xd = move.touches[0].clientX - start.touches[0].clientX
        const yd = move.touches[0].clientY - start.touches[0].clientY
        let t = []
        if (Math.abs(xd) > 30) t.push(xd < 0 ? 'a' : 'd')   // leave a small dead zone for each axis,
        if (Math.abs(yd) > 30) t.push(yd < 0 ? 'w' : 's')   // so that you can get pure directions or stop.
        vdirs.forEach(x => (t    .indexOf(x)<0) && up  (x)) // clear keys no longer held
        t    .forEach(x => (vdirs.indexOf(x)<0) && down(x)) // push keys that were not held before
        vdirs = t
        pd(move)
      }
      const te = end => {
        // within cookoff period, translate into key-down-up:
        if (cancel) {
          cancel = clearTimeout(cancel)
          down('e'),setTimeout(_=>up('e'),100)
        }
        // otherwise, clear our virtual directions:
        vdirs.map(up)
        rel('touchmove',tm),rel('touchend',te),pd(end)
      }
      let cancel = setTimeout(_ => (rel('touchmove',tm),rel('touchend',te),ael('touchend',tt),down('e')), 200)
      ael('touchmove',tm),ael('touchend',te)
    }
    else if (start.touches.length == 2) {
      // alt action
      const te = end => (up('q'),rel('touchend',te),pd(end))
      down('q'),ael('touchend',te)
    }
  })

}