/**
* Adaptive Input
**/

const ael = (element, event, listener) => element.addEventListener   (event, listener, { passive:false })
const rel = (element, event, listener) => element.removeEventListener(event, listener, { passive:false })
const pd  = event => (event.preventDefault(),event.stopPropagation())

function addPointer(element,start,move,end){
  function mouseToTouch(f){
    return event=>{
      const to={indentifier:1,target:element,clientX:event.clientX,clientY:event.clientY}
      f({changedTouches:[to],touches:[to],preventDefault:_=>{},stopPropagation:_=>{}})
    }
  }
  let mousedown=false
  const events={
    touchstart: start,
    touchmove:  move,
    touchend:   end,
    mousedown:  mouseToTouch(e=>{mousedown=true;start(e)}),
    mousemove:  mouseToTouch(e=>{if(mousedown)move(e)}),
    mouseup:    mouseToTouch(e=>{mousedown=false;end(e)}),
    mouseout:   mouseToTouch(e=>{mousedown=false;end(e)}),
  }
  Object.keys(events).forEach(k=>ael(element,k,events[k]))
  return _=>{Object.keys(events).forEach(k=>rel(element,k,events[k]))}
}

const VIP_HEX  = '123c456d789ea0bf'.split('')
const VIP_KEYS = VIP_HEX.map(x => parseInt(x,16))

const GAMEPAD_STYLES = `
.gamepad{
  position:absolute;
  top:10%;
  left:0px;
  width:100%;
  height:90%;
  opacity:0.3;
  user-select: none;
  -webkit-user-select: none;
}
.gamepad .dpad{
  position:absolute;
  bottom: 50px;
  left:   50px;
  width:  250px;
  height: 250px;
  background: gray;
  border-radius: 50%;
  overflow:hidden;
}
.gamepad .stick{
  display:none;
  position:absolute;
  border-radius: 50%;
  width:100px;
  height:100px;
  margin-left:-50px;
  margin-top:-50px;
}
.gamepad .buttons{
  position:absolute;
  bottom: 50px;
  right:  50px;
  width:  250px;
  height: 250px;
}
.gamepad .gamebutton{
  position:absolute;
  width:  125px;
  height: 125px;
  background:gray;
  border-radius:50%;
  overflow:hidden;
  line-height: 125px;
  font-size:50px;
  font-weight:bold;
  color:darkgray;
  text-align:center;
}
.gamepad .dpad.active .stick {display:block;background:#444}
.gamepad .gamebutton.active{background:#444;}
.gamepad .gamebutton.b{left:0;bottom:0;}
.gamepad .gamebutton.a{right:0;top:0;}
`
const VIP_STYLES = `
.vip-pad {display:flex;flex-direction:column;align-items:center;z-index:2000;}
.vip-pad .keypad {display:flex;flex-direction:column;margin-top:10px;}
.vip-pad .keypad>div {display:flex;flex-direction:row;}
.vip-pad .keypad>div>div {
  -webkit-user-select: none;
  user-select: none;
  background:gray;
  width: 100px;
  height: 51px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 1px;
}
.vip-pad .keypad>div>div:active,
.vip-pad .keypad>div>div.active {background:black; border:1px solid white;margin:0px;}
`

const INPUT_MODULES = {
  /**
  * An invisible set of gesture recognizers,
  * giving directional input and an action for taps.
  **/
  swipe: {
    install: (screen,up,down,options) => {

      let vdirs      = []
      let direction  = { i:null, sx:0, sy:0, lx:0, ly:0 }
      let action1    = {}
      let taptimeout = null

      const updateStick = _ => {
        // find the relative position of the stick to its starting point
        const cx = direction.lx - direction.sx
        const cy = direction.ly - direction.sy

        // update the virtual direction buttons
        let t = []
        const DEAD_ZONE = 30
        if (Math.abs(cx) > DEAD_ZONE) t.push(cx < 0 ? options.left : options.right)
        if (Math.abs(cy) > DEAD_ZONE) t.push(cy < 0 ? options.up   : options.down)
        vdirs.forEach(x => (t    .indexOf(x)<0) && up  (x)) // clear keys no longer held
        t    .forEach(x => (vdirs.indexOf(x)<0) && down(x)) // push keys that were not held before
        vdirs = t
      }
      const tapDown= i => {
        if (Object.keys(action1).length == 0) down(options.action1)
        action1[i] = true
        if (i == direction.i) { direction = { i:null, sx:0, sy:0, lx:0, ly:0 } }
        taptimeout = null
      }
      const start = e => {
        const t = e.touches[0]
        const i = t.identifier
        // a single-touch is either directional or a tap...
        if (direction.i != null) {
          tapDown(i)
        }
        else {
          direction.i  = i
          direction.sx = t.clientX
          direction.sy = t.clientY
          direction.lx = t.clientX
          direction.ly = t.clientY
          taptimeout = setTimeout(_ => tapDown(i), 100)
        }
        updateStick(),pd(e)
      }
      const move = e => {
        for(let z = 0; z < e.changedTouches.length; z++) {
          const t = e.changedTouches[z]
          const i = t.identifier
          if (i == direction.i) {
            if (taptimeout != null) { clearTimeout(taptimeout); taptimeout = null }
            direction.lx = t.clientX
            direction.ly = t.clientY
          }
        }
        updateStick(),pd(e)
      }
      const end = e => {
        let r1 = false
        for(let z = 0; z < e.changedTouches.length; z++) {
          const t = e.changedTouches[z]
          const i = t.identifier
          if (i == direction.i) {
            if (taptimeout != null) {
              // cancel a short tap
              clearTimeout(taptimeout); taptimeout = null
              down(options.action1)
              setTimeout(_ => up(options.action1), 50)
            }
            direction = { i:null, sx:0, sy:0, lx:0, ly:0 }
          }
          if (i in action1) {
            delete action1[i]
            r1=true
          }
        }
        if (r1 && Object.keys(action1).length == 0) up(options.action1)
        updateStick(),pd(e)
      }
      ael(screen, 'touchstart', start)
      ael(screen, 'touchmove',  move)
      ael(screen, 'touchend',   end)
      screen.uninstallSwipe = _ => {
        rel(screen, 'touchstart', start)
        rel(screen, 'touchmove',  move)
        rel(screen, 'touchend',   end)
      }
    },
    remove: (screen) => {
      screen.uninstallSwipe()
      delete screen.uninstallSwipe
    }
  },

  /**
  * A virtual gamepad overlay with two remappable action keys.
  **/
  gamepad: {
    install: (screen,up,down,options) => {
      // build the UI
      if (document.querySelector('.gamepad')) return
      const root = document.createElement('div')
      root.classList.add('gamepad')
      root.innerHTML = `
      <div class='dpad'><div class='stick'></div></div>
      <div class='buttons'><div class='gamebutton b'>B</div><div class='gamebutton a'>A</div></div>
      <style>${GAMEPAD_STYLES}</style>`
      screen.parentElement.append(root)

      let vdirs      = []
      let directions = {}
      let buttons    = {}
      const pad   = document.querySelector('.gamepad .dpad')
      const stick = document.querySelector('.gamepad .dpad .stick')
      const a     = document.querySelector('.gamepad .gamebutton.a')
      const b     = document.querySelector('.gamepad .gamebutton.b')

      const updateStick = _ => {
        // find centroid of d-pad touchpoints ({0,0} if no touchpoints)
        const touches = Object.values(directions)
        let cx = 0, cy = 0, r = pad.getBoundingClientRect(), sr = stick.getBoundingClientRect()
        touches.forEach(t => (cx+=t.x, cy+=t.y))
        cx /= touches.length,         cy /= touches.length
        cx -= (r.left + (r.width/2)), cy -= (r.top + (r.height/2))

        // position the virtual stick, clamped within dpad
        const ca = Math.atan2(cy, cx)
        const cd = Math.min(Math.sqrt(cx*cx + cy*cy), (r.width/2)-(sr.width/2))
        stick.style.left = ((Math.cos(ca)*cd)+(r.width /2)|0)+'px'
        stick.style.top  = ((Math.sin(ca)*cd)+(r.height/2)|0)+'px'

        // update the virtual direction buttons
        let t = []
        const DEAD_ZONE = 30
        if (Math.abs(cx) > DEAD_ZONE) t.push(cx < 0 ? options.left : options.right)
        if (Math.abs(cy) > DEAD_ZONE) t.push(cy < 0 ? options.up   : options.down)
        vdirs.forEach(x => (t    .indexOf(x)<0) && up  (x)) // clear keys no longer held
        t    .forEach(x => (vdirs.indexOf(x)<0) && down(x)) // push keys that were not held before
        vdirs = t
      }

      const start = e => {
        for(let z = 0; z<e.touches.length; z++) {
          const t = e.touches[z]
          const i = t.identifier
          if (t.target == a) {
            t.target.classList.add('active')
            buttons[i]=options.action1
            down(options.action1)
          }
          if (t.target == b) {
            t.target.classList.add('active')
            buttons[i]=options.action2
            down(options.action2)
          }
          if (t.target == pad) {
            t.target.classList.add('active')
            directions[i]={x:t.clientX, y:t.clientY}
          }
        }
        updateStick(),pd(e)
      }
      const move = e => {
        for(let z = 0; z<e.changedTouches.length; z++) {
          const t = e.changedTouches[z]
          const i = t.identifier
          if (i in directions) directions[i]={x:t.clientX, y:t.clientY}
        }
        updateStick(),pd(e)
      }
      const end = e => {
        for(let z = 0; z<e.changedTouches.length; z++) {
          const t = e.changedTouches[z]
          const i = t.identifier
          if (i in buttons) {
            t.target.classList.remove('active')
            up(buttons[i])
            delete buttons[i]
          }
          if (i in directions) {
            t.target.classList.remove('active')
            delete directions[i]
          }
        }
        updateStick(),pd(e)
      }

      ael(a,   'touchstart', start)
      ael(a,   'touchend',   end  )
      ael(b,   'touchstart', start)
      ael(b,   'touchend',   end  )
      ael(pad, 'touchstart', start)
      ael(pad, 'touchmove',  move )
      ael(pad, 'touchend',   end  )
    },
    remove: (screen) => {
      document.querySelector('.gamepad').remove()
    },
  },

  /**
  * Treat the entire screen, or a centered square region, as invisible buttons,
  * mapped out in the order of the VIP hex keypad.
  **/
  seg16: {
    install: (screen,up,down,options) => {
      const tmap = {}
      const pointToKey = touch => {
        // poll this for each point, as it may vary over time,
        // and experimentally it's never right initially...
        const r = screen.getBoundingClientRect()
        if (options.mode == 'center') {
          if (r.width > r.height) { r.x += (r.width - r.height)/2; r.width = r.height }
          else                    { r.y += (r.height - r.width)/2; r.height = r.width }
        }
        const x = touch.clientX - r.x
        const y = touch.clientY - r.y
        if (x < 0 || x > r.width || y < 0 || y > r.height) return null
        const tx = Math.floor(x / (r.width /4))
        const ty = Math.floor(y / (r.height/4))
        return VIP_KEYS[tx + (4 * ty)]
      }
      const start = e => {
        for(let z=0; z<e.touches.length; z++) {
          const i = e.touches[z].identifier
          const k = pointToKey(e.touches[z])
          if (k != null) down(k)
          tmap[i]=k
        }
        pd(e)
      }
      const move = e => {
        for(let z=0; z<e.touches.length; z++) {
          const i = e.touches[z].identifier
          const k = pointToKey(e.touches[z])
          if (tmap[i] == k) continue       // same cell, nothing to do.
          if (tmap[i] != null) up(tmap[i]) // release old key, if any
          if (k != null)       down(k)     // press new key, if any
          tmap[i]=k
        }
        pd(e)
      }
      const end = e => {
        for(let z=0; z<e.changedTouches.length; z++) {
          const i = e.changedTouches[z].identifier
          const k = pointToKey(e.changedTouches[z])
          if (tmap[i] != null) up(tmap[i])
          tmap[i]=null
        }
        pd(e)
      }
      screen.uninstallSeg16=addPointer(screen,start,move,end)
    },
    remove:  (screen) => {
      screen.uninstallSeg16()
      delete screen.uninstallSeg16
    },
  },

  /**
  * Provide a visible 4x4 representation of the VIP hex keypad.
  **/
  vip: {
    install: (screen,up,down,options) => {
      if (document.querySelector('.vip-pad')) return
      const root = document.createElement('div')
      root.classList.add('vip-pad')
      root.innerHTML = `<div class='keypad'>
        ${[0,1,2,3].map(r=>`<div>${[0,1,2,3].map(c=>`<div>${VIP_HEX[c+(r*4)].toUpperCase()}</div>`).join('')}</div>`).join('')}
      </div>
      <style>${VIP_STYLES}</style>`
      if (screen.parentElement == document.body) { screen.parentElement.append(root) }
      else { screen.parentElement.parentElement.append(root) }
      const buttons = []
      document.querySelectorAll('.vip-pad .keypad>div>div').forEach(x=>buttons.push(x)) // make an actual Array
      const held = {}
      const start = e => {
        for(let z=0; z<e.touches.length; z++) {
          const t = e.touches[z]
          const i = t.identifier
          const k = VIP_KEYS[buttons.indexOf(t.target)]
          t.target.classList.add('active')
          down(k)
          held[i]=k
        }
        pd(e)
      }
      const end = e => {
        for(let z = 0; z<e.changedTouches.length; z++) {
          const t = e.changedTouches[z]
          const i = t.identifier
          if (held[i] != undefined) { up(held[i]); delete held[i] }
          t.target.classList.remove('active')
        }
        pd(e)
      }
      buttons.forEach(b => addPointer(b,start,_=>{},end))
    },
    remove:  (screen) => {
      document.querySelector('.vip-pad').remove()
    },
  },
}

let adaptiveControlsInstalled = null

function injectAdaptiveControls(type, screen, keyup, keydown) {
  let options = {
    up:      5,
    down:    8,
    left:    7,
    right:   9,
    action1: 6,
    action2: 4,
    mode:    'center', // or 'fill', used by seg16
  }
  const lookup = vk => Object.keys(keymap[vk])[0]
  const install = _ => {
    rel(screen, 'touchstart', install)
    rel(screen, 'mousedown',  install)
    adaptiveControlsInstalled = type
    INPUT_MODULES[type].install(
      screen,
      key => keyup  ({ key:lookup(key), preventDefault:_=>_ }),
      key => keydown({ key:lookup(key), preventDefault:_=>_ }),
      options
    )
  }
  // uninstall anything that's already there:
  rel(screen, 'touchstart', install)
  rel(screen, 'mousedown' , install)
  if (adaptiveControlsInstalled) INPUT_MODULES[adaptiveControlsInstalled].remove(screen)

  if (type == 'none') return
  if (type == 'seg16fill') { type='seg16'; options.mode='fill' }
  // defer installing adaptive input until we actually see
  // an input event from the user:
  ael(screen, 'touchstart', install)
  ael(screen, 'mousedown',  install)
}
