import React, { Component } from "react";
import PeerValidator from './peerValidator';

export default class Menu extends Component {
  constructor(props) {
    super(props);

    this.state = { action: null }
  }

  render() {
    if (!this.state.action) {
      return (
        <div className='flex-column'>
          <button
          >
            Solo Play
          </button>
          <button
          >
            Join Room
          </button>
          <button
            onClick={() =>
              this.setState({ action: 'duell' })
            }
          >
            Join Duell
          </button>
        </div>
      );
    } else if (this.state.action === 'duell') {
      return (
        <PeerValidator />
      )
    }
  }
}
