import {beforeEach,afterEach,vi} from 'vitest';
import {cleanup} from '@testing-library/react';
Object.defineProperty(HTMLDialogElement.prototype,'showModal',{value:function(){this.setAttribute('open','');}});
Object.defineProperty(HTMLDialogElement.prototype,'close',{value:function(){this.removeAttribute('open');}});
Object.defineProperty(window,'scrollTo',{value:vi.fn()});
beforeEach(()=>{localStorage.clear();window.location.hash='';});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
