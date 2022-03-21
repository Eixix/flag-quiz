import React, { Component } from "react";
import Countries from "../res/ISO3166-1.alpha2_en.json";
import Levenshtein from "fast-levenshtein";
import party from "party-js";

export default class FlagGuesser extends Component {
  constructor(props) {
    super(props);

    const [countryCode, countryName] = this.randomCountry();
    this.state = {
      countryCode,
      countryName,
      score: 0,
      enemyScore: 0,
      inputValue: "",
      peer: this.props.peer,
      connection: this.props.connection,
      skips: 3,
      goalScore: 10,
      won: undefined,
    };

    this.state.connection.on(
      "data",
      function (data) {
        if (data === "won") {
          this.setState({ won: false });
        } else {
          this.setState((prevState) => ({
            enemyScore: prevState.enemyScore + 1,
          }));
        }
      }.bind(this)
    );
  }

  randomCountry() {
    const keys = Object.keys(Countries);
    const random = (keys.length * Math.random()) << 0;
    const countryCode = keys[random];
    const countryName = Countries[countryCode];
    return [countryCode.toLowerCase(), countryName];
  }

  skipCountry() {
    if (this.state.skips > 0) {
      this.setState((prevState) => ({
        skips: prevState.skips - 1,
      }));

      this.setState({ inputValue: "" });
      const [countryCode, countryName] = this.randomCountry();
      this.setState({ countryCode, countryName });
    }
  }

  validateInput(event) {
    const inputValue = event.target.value.toLowerCase();
    const stateValue = this.state.countryName.toLowerCase();
    this.setState({ inputValue });

    if (
      Levenshtein.get(inputValue.trim(), stateValue.trim()) < 2 &&
      inputValue.trim().length == stateValue.trim().length
    ) {
      this.setState({ error: false });
      this.setState({ success: true });
      this.setState((prevState) => ({
        score: prevState.score + 1,
      }));

      this.setState({ inputValue: "" });
      const [countryCode, countryName] = this.randomCountry();
      this.setState({ countryCode, countryName });

      if (this.state.score >= this.state.goalScore - 1) {
        this.state.connection.send("won");
        this.setState({ won: true });
        party.confetti(document.body, {
          count: party.variation.range(100, 250),
        });
      } else {
        setTimeout(() => this.setState({ success: false }), 2000);
        this.state.connection.send("+1");
      }
    } else if (
      Levenshtein.get(inputValue, stateValue) > 6 &&
      !stateValue.includes(inputValue)
    ) {
      this.setState({ success: false });
      this.setState({ error: true });
    } else {
      this.setState({ error: false });
      this.setState({ success: false });
    }
  }

  render() {
    if (this.state.won === undefined) {
      return (
        <div className='flag-container'>
          <h2 className={"flag-score " + (this.state.success ? "success" : "")}>
            {this.props.ownName}: {this.state.score}{" "}
          </h2>
          <h2>
            {this.props.targetName}: {this.state.enemyScore}
          </h2>
          <h2>Which country is this?</h2>
          <span className={"big-flag fi fi-" + this.state.countryCode}></span>
          <input
            className={
              this.state.error ? "error" : this.state.success ? "success" : ""
            }
            autoFocus
            value={this.state.inputValue}
            type='text'
            onChange={this.validateInput.bind(this)}
          />
          <button
            disabled={this.state.skips <= 0 ? true : undefined}
            onClick={this.skipCountry.bind(this)}
          >
            Skip ({this.state.skips} left)
          </button>
        </div>
      );
    } else {
      return (
        <div className='flag-container'>
          <h1>{this.state.won ? "YOU WON!" : "YOU LOST!"}</h1>
        </div>
      );
    }
  }
}
