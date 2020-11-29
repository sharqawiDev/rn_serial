import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Animated, Easing } from "react-native"
export default function header() {
    const spinValue = new Animated.Value(0);
    const spinValue2 = new Animated.Value(0);

    // First set up animation 
    Animated.loop(
        Animated.timing(
            spinValue,
            {
                toValue: 1,
                duration: 12000,
                easing: Easing.linear,
                useNativeDriver: true
            }
        )
    ).start();
    Animated.loop(
        Animated.timing(
            spinValue2,
            {
                toValue: 1,
                duration: 16000,
                easing: Easing.linear,
                useNativeDriver: true
            }
        )
    ).start();

    // Next, interpolate beginning and end values (in this case 0 and 1)
    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    })
    const spin2 = spinValue2.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    })

    styles = StyleSheet.create({
        container: {
            left: 170
        },
        ec: {
            width: 545,
            height: 525,
            position: "absolute",
            top: -200,
            right: -80,
            opacity: 0.63,
            borderRadius: 300,
            backgroundColor: 'hsl(74,100%,62.9%)',
            transform: [
                { scaleX: 1.5 },
            ]
        },
        ec2: {
            width: 545,
            height: 500,
            position: "absolute",
            top: -200,
            right: 0,
            opacity: 0.7,
            borderRadius: 300,
            backgroundColor: '#00ED11',
            transform: [
                { scaleX: 1.8 }
            ]
        },
        ec3: {
            width: 500,
            height: 600,
            position: "absolute",
            top: -250,
            right: -35,
            opacity: 1,
            borderRadius: 300,
            borderColor: "white",
            borderWidth: 4,
            // backgroundColor: '#00ED11',
            transform: [
                { scaleX: 1.8 }
            ]
        }
    })

    return (
        <View style={styles.container}>
            {/* <View style={styles.ec2}></View> */}
            <Animated.View style={[styles.ec2, { transform: [{ rotate: spin }] }]} />
            <Animated.View style={[styles.ec, {
                transform: [{ rotate: spin2 }]
            }]} />
            <Animated.View style={[styles.ec3, { transform: [{ rotate: spin2 }] }]} />
        </View>
    )
}


