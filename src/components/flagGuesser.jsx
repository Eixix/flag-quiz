import React, { Component } from "react";
import Countries from "../res/ISO3166-1.alpha2_en.json";
import Levenshtein from "fast-levenshtein";

export default class FlagGuesser extends Component {
  constructor(props) {
    super(props);

    const [countryCode, countryNames] = this.randomCountry();
    this.state = {
      countryCode,
      countryNames,
      score: 0,
      enemyScore: 0,
      inputValue: "",
      peer: this.props.peer,
      connection: this.props.connection,
      skips: 3,
    };

    this.state.connection.on(
      "data",
      function (data) {
        this.setState((prevState) => ({
          enemyScore: prevState.enemyScore + 1,
        }));
      }.bind(this)
    );
  }

  randomCountry() {
    const keys = Object.keys(Countries);
    const random = (keys.length * Math.random()) << 0;
    const countryCode = keys[random];
    const countryNames = Countries[countryCode];
    return [countryCode.toLowerCase(), countryNames];
  }

  skipCountry() {
    if (this.state.skips > 0) {
      this.setState((prevState) => ({
        skips: prevState.skips - 1,
      }));

      this.setState({ inputValue: "" });
      const [countryCode, countryNames] = this.randomCountry();
      this.setState({ countryCode, countryNames });
    }
  }

  validateInput(event) {
    const inputValue = event.target.value.toLowerCase();
    const stateValue = this.state.countryNames.map(name => name.toLowerCase());
    this.setState({ inputValue });

    if (stateValue.find(countryName => countryName === inputValue)) {
      this.setState({ error: false });
      this.setState({ success: true });
      this.setState((prevState) => ({
        score: prevState.score + 1,
      }));

      this.setState({ inputValue: "" });
      const [countryCode, countryNames] = this.randomCountry();
      this.setState({ countryCode, countryNames });

      setTimeout(() => this.setState({ success: false }), 2000);
      this.state.connection.send("Got one");
    } else if (
      stateValue.map(countryName => Levenshtein.get(inputValue, countryName)).reduce((prev, curr) => Math.min(prev, curr), Number.MAX_SAFE_INTEGER) > 6 &&
      inputValue.length > 7
    ) {
      this.setState({ success: false });
      this.setState({ error: true });
    } else {
      this.setState({ error: false });
      this.setState({ success: false });
    }
  }

  render() {
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
  }
}
