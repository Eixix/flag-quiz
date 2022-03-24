import React, { Component } from "react";
import Peer from "peerjs";
import Swal from "sweetalert2";
import FirstToXPoints from "./quizComponents/firstToXPoints";

import Flags from "../res/countryFlags.json";

const baseString = "e764INqYEz7mB6ern4YI";

export default class PeerValidator extends Component {
  constructor(props) {
    super(props);
    this.state = { connected: false };
  }

  createPeer() {
    this.setState({ loading: true });
    const peer = new Peer(`${baseString}-${this.state.ownName}`, {
      host: "3f7e15ba-9164-450a-a050-3515dbe9f5ea.ul.bw-cloud-instance.org",
      port: 9000,
      path: "/myapp",
      config: {
        iceServers: [
          {
            urls: "stun:openrelay.metered.ca:80",
          },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      },
    });
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

    peer.on(
      "error",
      // TODO: Split into different errors
      function (connection) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "There is an error with your connection!",
        });
        this.setState({
          loading: false,
          connected: false,
          ownName: undefined,
          peer: undefined,
        });
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
        <form className='login-container'>
          <h2>Input user name:</h2>
          <input
            autoFocus
            type='text'
            key={1}
            className='login-input'
            onChange={(e) => this.setState({ ownName: e.target.value })}
            placeholder='Enter your name'
          />
          <input
            value='Login'
            type='submit'
            onClick={this.createPeer.bind(this)}
            disabled={!this.state.ownName ? true : undefined}
          ></input>
        </form>
      );
    } else if (!this.state.connected && this.state.peer) {
      return (
        <form className='connection-container'>
          <h2>{this.state.loading ? "LOADING..." : this.state.ownName}</h2>
          <input
            autoFocus
            type='text'
            key={2}
            className='connection-input'
            onChange={(e) =>
              this.setState({ targetName: e.target.value.trim() })
            }
            placeholder='Where do you want connect?'
          />
          <input
            value='Connect'
            type='submit'
            disabled={this.state.loading ? true : undefined}
            onClick={this.connect.bind(this)}
          ></input>
        </form>
      );
    } else {
      return (
        // TODO: Game choosing components
        <FirstToXPoints
          connectionSettings={{
            peer: this.state.peer,
            connection: this.state.connection,
            ownName: this.state.ownName,
            targetName: this.state.targetName,
            setConnectionState: (e) => this.setState(e),
          }}
          gameSettings={{
            questions: Flags,
            questionRenderer: (e) => (
              <span className={"big-flag fi fi-" + e}></span>
            ),
            heading: "Which country is this?",
          }}
        ></FirstToXPoints>
      );
    }
  }
}
