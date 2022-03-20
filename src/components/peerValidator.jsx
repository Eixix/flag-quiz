import React, { Component } from "react";
import FlagGuesser from "./flagGuesser";
import Peer from "peerjs";

const baseString = "e764INqYEz7mB6ern4YI";

export default class PeerValidator extends Component {
  constructor(props) {
    super(props);
    this.state = { connected: false };
  }

  createPeer() {
    this.setState({ loading: true });
    const peer = new Peer(`${baseString}-${this.state.ownName}`);
    peer.on(
      "open",
      function () {
        this.setState({ loading: false });
      }.bind(this)
    );

    peer.on(
      "connection",
      function (connection) {
        const targetName = connection.peer.substring(baseString.length + 1);
        connection.on("data", function (data) {
          console.log("Received " + data);
        });
        this.setState({ connected: true, connection, targetName });
      }.bind(this)
    );

    this.setState({ peer });
  }

  connect() {
    const peer = this.state.peer;
    const connection = peer.connect(`${baseString}-${this.state.targetName}`);

    connection.on("open", function () {
      // Receive messages
      connection.on("data", function (data) {
        console.log("Received " + data);
      });
    });
    this.setState({ connected: true, peer, connection });
  }

  render() {
    if (!this.state.connected && !this.state.peer) {
      return (
        <div className='login-container'>
          <h2>Input user name:</h2>
          <input
            type='text'
            className='login-input'
            onChange={(e) => this.setState({ ownName: e.target.value.trim() })}
          />
          <button onClick={this.createPeer.bind(this)}>Login!</button>
        </div>
      );
    } else if (!this.state.connected && this.state.peer) {
      return (
        <div className='connection-container'>
          <h2>{this.state.loading ? "LOADING..." : this.state.ownName}</h2>
          <input
            type='text'
            className='connection-input'
            onChange={(e) =>
              this.setState({ targetName: e.target.value.trim() })
            }
          />
          <button
            disabled={this.state.loading ? true : undefined}
            onClick={this.connect.bind(this)}
          >
            Connect!
          </button>
        </div>
      );
    } else {
      return (
        <FlagGuesser
          peer={this.state.peer}
          connection={this.state.connection}
          ownName={this.state.ownName}
          targetName={this.state.targetName}
        ></FlagGuesser>
      );
    }
  }
}
