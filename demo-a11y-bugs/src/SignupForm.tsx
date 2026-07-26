// Demo file: remediated signup form accessibility examples.
import React from 'react';

export function SignupForm() {
  return (
    <div>
      <img src="/logo.png" alt="EasyAlliance" />

      <label htmlFor="email">Email</label>
      <input id="email" type="text" name="email" placeholder="Email" />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" name="password" />

      <button type="button" onClick={() => submit()}>Submit</button>

      <button type="button">Sign up</button>

      {/* positive tabindex */}
      <a href="#" tabIndex={5}>Skip</a>

      <a href="/help">Help</a>

      <input type="image" src="/go.png" alt="Continue" aria-label="Continue" />
    </div>
  );
}

function submit() {}
