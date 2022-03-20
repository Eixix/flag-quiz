import React, { Component } from "react";
import FlagGuesser from "./flagGuesser";
import SimplePeer from "simple-peer";

const baseString = "e764INqYEz7mB6ern4YI";

export default class PeerValidator extends Component {
  constructor(props) {
    super(props);
    this.state = { connected: false };
  }

  connect() {
    const peer = new SimplePeer({
      initiator: location.hash === "#1",
      trickle: false,
    });
    this.setState({ connected: true, peer, connection });
  }

  render() {
    if (this.state.connected) {
      return (
        <FlagGuesser
          peer={this.state.peer}
          connection={this.state.connection}
        ></FlagGuesser>
      );
    } else {
      return (
        <div>
          <input
            type='text'
            onChange={(e) => this.setState({ ownName: e.target.value })}
          />
          <input
            type='text'
            onChange={(e) => this.setState({ targetName: e.target.value })}
          />
          <button onClick={this.connect.bind(this)}>Connect!</button>
        </div>
      );
    }
  }
}
