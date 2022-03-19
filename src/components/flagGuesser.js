import React, { Component } from 'react'
import Countries from '../res/ISO3166-1.alpha2.json'

export default class FlagGuesser extends Component {
    constructor(props) {
        super(props)

        const [countryCode, countryName] = this.randomCountry();
        this.state = { countryCode, countryName, score: 0 };
    }

    randomCountry() {
        const keys = Object.keys(Countries);
        const random = keys.length * Math.random() << 0
        const countryCode = keys[random]
        const countryName = Countries[countryCode]
        return [countryCode.toLowerCase(), countryName]
    };

    validateInput(event) {
        console.log(event.target.value);
        if (this.state.countryName.toLowerCase() === event.target.value.toLowerCase()) {
            this.this.setState((prevState) => ({
                score: prevState.score + 1
            }));
            const [countryCode, countryName] = this.randomCountry();
            this.setState({ countryCode, countryName });
        }
    }

    render() {
        return (
            <div className='flag-container'>
                <h1>{this.state.score}</h1>
                <h1>Which country is this?</h1>
                <span className={'big-flag fi fi-' + this.state.countryCode}></span>
                <input type='text' onChange={this.validateInput}></input>
            </div>
        )
    }
}
