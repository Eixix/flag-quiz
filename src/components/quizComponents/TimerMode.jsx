import React, { Component } from "react";
import Levenshtein from "fast-levenshtein";
import party from "party-js";
import secondsToTime from "../../services/secondsToTime";

export default class TimerMode extends Component {
  constructor(props) {
    super(props);

    this.state = {
      allQuestions: this.props.gameSettings.questions,
      skippedQuestions: {},
      question: "",
      solutions: "",
      score: 0,
      enemyScore: 0,
      inputValue: undefined,
      peer: this.props.connectionSettings.peer,
      connection: this.props.connectionSettings.connection,
      skips: this.props.gameSettings.skips,
      time: undefined,
      seconds: this.props.gameSettings.time,
      won: undefined,
    };
    this.timer = 0;

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

  componentDidMount() {
    const timeLeft = secondsToTime(this.state.seconds);
    this.setState({ time: timeLeft });
    this.getNextQuestion();
    this.timer = setInterval(this.countDown.bind(this), 1000);
  }

  countDown() {
    // Remove one second, set state so a re-render happens.
    const seconds = this.state.seconds - 1;
    this.setState({
      time: secondsToTime(seconds),
      seconds: seconds,
    });

    // Check if we're at zero for winning player.
    if (seconds == 0) {
      if (this.state.enemyScore > this.state.score) {
        clearInterval(this.timer);
        this.setState({ won: false });
      } else if (this.state.enemyScore < this.state.score) {
        clearInterval(this.timer);
        this.state.connection.send("won");
        this.setState({ won: true });
        party.confetti(document.body, {
          count: party.variation.range(100, 250),
        });
      } else {
        // Extend time to play by 10 seconds because there is no winner
        this.setState({ seconds: 10 });
      }
    }
  }

  getNextQuestion() {
    const allQuestions = this.state.allQuestions;
    const keys = Object.keys(allQuestions);
    const random = (keys.length * Math.random()) << 0;
    const question = keys[random];
    const solutions = allQuestions[question];

    delete allQuestions[question];

    this.setState({
      allQuestions,
      question: question.toLowerCase(),
      solutions,
    });
  }

  skipQuestion() {
    if (this.state.skips > 0) {
      this.setState((prevState) => ({
        skips: prevState.skips - 1,
      }));

      this.setState({ inputValue: "" });
      const [question, solutions] = this.getNextQuestion();
      this.setState({ question, solutions });
    }
  }

  validateInput(event) {
    const inputValue = event.target.value.toLowerCase();
    const stateValue = this.state.solutions.map((name) => name.toLowerCase());
    this.setState({ inputValue });

    const mappedStateValues = stateValue.map((solution) => {
      return {
        distance: Levenshtein.get(inputValue.trim(), solution.trim()),
        solution: solution.trim(),
      };
    });
    if (
      mappedStateValues.reduce(
        (prev, curr) =>
          prev ||
          (curr.distance < 2 &&
            curr.solution.length === inputValue.trim().length),
        false
      )
    ) {
      this.setState({ error: false });
      this.setState({ success: true });
      this.setState((prevState) => ({
        score: prevState.score + 1,
      }));

      this.setState({ inputValue: "" });
      this.getNextQuestion();

      this.state.connection.send("+1");
      setTimeout(() => this.setState({ success: false }), 2000);
    } else if (
      mappedStateValues.reduce(
        (prev, curr) =>
          prev ||
          (curr.distance > 6 && !curr.solution.includes(inputValue.trim())),
        false
      )
    ) {
      this.setState({ success: false });
      this.setState({ error: true });
    } else {
      this.setState({ error: false });
      this.setState({ success: false });
    }
  }

  playAgain() {
    this.props.connectionSettings.setConnectionState({ connected: false });
  }

  render() {
    if (this.state.won === undefined) {
      return (
        <div className='quiz-container'>
          <h2>Time: {this.state.time ?? "00:00"}</h2>
          <h2 className={"quiz-score " + (this.state.success ? "success" : "")}>
            {this.props.connectionSettings.ownName}: {this.state.score}{" "}
          </h2>
          <h2>
            {this.props.connectionSettings.targetName}: {this.state.enemyScore}
          </h2>
          <h2>{this.props.gameSettings.heading}</h2>
          {this.props.gameSettings.questionRenderer(this.state.question)}
          <input
            className={
              this.state.error ? "error" : this.state.success ? "success" : ""
            }
            autoFocus
            value={this.state.inputValue}
            type='text'
            onChange={this.validateInput.bind(this)}
            placeholder='Input country'
          />
          <button
            disabled={this.state.skips <= 0 ? true : undefined}
            onClick={this.skipQuestion.bind(this)}
          >
            Skip ({this.state.skips} left)
          </button>
        </div>
      );
    } else {
      return (
        <div className='quiz-container'>
          <h1>{this.state.won ? "YOU WON!" : "YOU LOST!"}</h1>
          <button onClick={this.playAgain.bind(this)}>Play again!</button>
        </div>
      );
    }
  }
}
